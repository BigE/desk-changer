import Gio from "gi://Gio";
import GObject from "gi://GObject";

import {APP_PATH} from "../common/interface.js";
import RotationModes from "../common/rotation_modes.js";
import {SettingsRotationModes} from "../common/settings.js";
import {SERVICE_ID, SERVICE_PATH} from "./interface.js";
import ServiceProfile from "./profile/index.js";
import ServiceTimer from "./timer/index.js";
import ServiceTimerHourly from "./timer/hourly.js";
import ServiceTimerDaily from "./timer/daily.js";
import GLib from "gi://GLib";


export default class Service extends GObject.Object {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerService",
            Properties: {
                "Preview": GObject.param_spec_string(
                    "Preview", "Preview",
                    "A preview of the upcoming wallpaper in the queue",
                    null, GObject.ParamFlags.READABLE
                ),
                "Running": GObject.param_spec_boolean(
                    "Running", "Running",
                    "Check if the daemon is running",
                    false, GObject.ParamFlags.READABLE
                )
            },
            Signals: {
                "Changed": { param_types: [GObject.TYPE_STRING] },
                "Start": {},
                "Stop": {},
            },
        }, this);
    }

    static getDBusInterfaceXML(): string {
        return (new TextDecoder()).decode(Gio.resources_lookup_data(GLib.build_filenamev([
            APP_PATH,
            'service',
            `${SERVICE_ID}.xml`
        ]), Gio.ResourceLookupFlags.NONE).toArray());
    }

    static getDBusInterfaceInfo(): Gio.DBusInterfaceInfo {
        const node_info = Gio.DBusNodeInfo.new_for_xml(Service.getDBusInterfaceXML());
        const dbus_info = node_info.lookup_interface(SERVICE_ID);

        if (!dbus_info)
            throw new Error('DBUS: Failed to find interface info');

        return dbus_info;
    }

    #background?: Gio.Settings;
    #current_profile_changed_id?: number;
    #dbus?: Gio.DBusExportedObject;
    #interval_changed_id?: number;
    #logger?: Console;
    #profile?: ServiceProfile;
    #profile_notify_preview_id?: number;
    #rotation_changed_id?: number;
    #running: boolean;
    #settings?: Gio.Settings;
    #timer?: ServiceTimer;

    get Preview() {
        return this.#profile?.preview || null;
    }

    get Running() {
        return this.#running;
    }

    constructor(settings: Gio.Settings, logger: Console) {
        super();

        this.#logger = logger;
        this.#settings = settings;
        this.#running = false;
        this.#background = Gio.Settings.new('org.gnome.desktop.background');
        // now expose the service on the session bus
        this.#expose_dbus();
    }

    destroy() {
        this.#dbus?.unexport();
        this.#dbus = undefined;

        if (this.#running)
            this.Stop();

        this.#background = undefined;
        this.#logger = undefined;
        this.#settings = undefined;
    }

    LoadProfile(profile_name?: string) {
        const profile: ServiceProfile = new ServiceProfile(this.#settings!, this.#logger!, {
            profile_name: profile_name || this.#settings!.get_string('current-profile')
        });

        profile.load();

        // Unload the currently loaded profile
        if (this.#profile) {
            if (this.#profile_notify_preview_id) {
                this.#profile.disconnect(this.#profile_notify_preview_id);
                this.#profile_notify_preview_id = undefined;
            }

            this.#profile.destroy(this.#background?.get_string('picture-uri'));
            this.#profile = undefined;
        }

        this.#profile = profile;
        this.#profile_notify_preview_id = this.#profile.connect('notify::preview', () => {
            if (this.#running) {
                this.notify('Preview');
                this.#dbus?.emit_property_changed('Preview', new GLib.Variant('s', this.Preview));
            }
        });

        if (this.#running) {
            // only set the wallpaper if we're already running
            this.#set_wallpaper(this.#profile.next());
            // restart the timer since the profile/wallpaper was just changed
            this.#restart_timer();
        }
    }

    Next() {
        if (!this.#running || !this.#profile)
            throw new Error("Service isn't running");

        const wallpaper = this.#profile.next(this.#background!.get_string('picture-uri'));
        this.#set_wallpaper(wallpaper);
        return wallpaper;
    }

    Previous() {
        if (!this.#running || !this.#profile)
            throw new Error("Service isn't running");

        const wallpaper = this.#profile.previous(this.#background!.get_string('picture-uri'));
        this.#set_wallpaper(wallpaper);
        return wallpaper;
    }

    Restart() {
        this.Stop();
        this.Start();
    }

    Start() {
        if (this.#running)
            throw new Error();

        if (!this.#profile)
            this.LoadProfile();

        // create the timer
        this.#create_timer();
        // advance the wallpaper
        this.#set_wallpaper(this.#profile!.next());
        // connect signals to detect changes
        this.#current_profile_changed_id = this.#settings!.connect('changed::current-profile', () => {
            this.LoadProfile(this.#settings!.get_string('current-profile'))
        });
        this.#rotation_changed_id = this.#settings!.connect('changed::rotation', () => {
            this.#restart_timer()
        });
        // fin.
        this.emit('Start');
        this.#dbus?.emit_signal('Start', new GLib.Variant('()', []));
    }

    Stop() {
        if (!this.#running)
            throw new Error();

        if (this.#current_profile_changed_id) {
            this.#settings!.disconnect(this.#current_profile_changed_id);
            this.#current_profile_changed_id = undefined;
        }

        if (this.#rotation_changed_id) {
            this.#settings!.disconnect(this.#rotation_changed_id);
            this.#rotation_changed_id = undefined;
        }

        this.#destroy_timer();
        this.emit('Stop');
        this.#dbus?.emit_signal('Stop', new GLib.Variant('()', []));
    }

    #create_timer() {
        if (this.#timer)
            throw new TypeError('Timer already exists');

        const rotation = this.#settings!.get_string('rotation') as SettingsRotationModes;

        if (RotationModes[rotation].timer === 'interval') {
            const interval = RotationModes[rotation].interval || this.#settings!.get_int('interval');
            this.#timer = new ServiceTimer(interval, () => Boolean(this.Next()));
            if (rotation === 'interval') {
                this.#interval_changed_id = this.#settings!.connect('changed::interval', this.#restart_timer.bind(this));
            }
        } else if (RotationModes[rotation].timer === 'daily') {
            this.#timer = new ServiceTimerHourly(() => Boolean(this.Next()));
        } else if (RotationModes[rotation].timer === 'hourly') {
            this.#timer = new ServiceTimerDaily(() => Boolean(this.Next()));
        }

        this.#running = true;
        this.notify('Running');
        this.#dbus?.emit_property_changed('Running', new GLib.Variant('b', this.Running));
    }

    #destroy_timer() {
        if (this.#timer) {
            if (this.#interval_changed_id) {
                this.#settings!.disconnect(this.#interval_changed_id);
                this.#interval_changed_id = undefined;
            }

            this.#timer.destroy();
            this.#timer = undefined;
        }

        this.#running = false;
        this.notify('Running');
        this.#dbus?.emit_property_changed('Running', new GLib.Variant('b', this.Running));
    }

    #expose_dbus() {
        try {
            const dbus_info = Service.getDBusInterfaceInfo();
            // wrapJSObject takes string|DBusInterfaceInfo
            // @ts-expect-error
            this.#dbus = Gio.DBusExportedObject.wrapJSObject(dbus_info, this);
            this.#dbus.export(Gio.DBus.session, SERVICE_PATH);
        } catch (e) {
            this.#logger?.error(`DBUS: Failed to export object: ${e}`);
        }
    }

    #restart_timer() {
        this.#destroy_timer();
        this.#create_timer();
    }

    #set_wallpaper(uri: string) {
        this.#background!.set_string('picture-uri', uri);
        this.#background!.set_string('picture-uri-dark', uri);
        this.emit('Changed', uri);
        this.#dbus?.emit_signal('Changed', new GLib.Variant('(s)', [ uri ]));
    }
}
