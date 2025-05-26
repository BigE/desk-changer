import Gio from "gi://Gio";
import GObject from "gi://GObject";

import RotationModes from "../common/rotation_modes.js";
import {SettingsRotationModes} from "../common/settings.js";
import ServiceProfile from "./profile/index.js";
import ServiceTimer from "./timer/index.js";
import ServiceTimerHourly from "./timer/hourly.js";
import ServiceTimerDaily from "./timer/daily.js";


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

    #background?: Gio.Settings;
    #current_profile_changed_id?: number;
    #interval_changed_id?: number;
    #logger?: Console;
    #profile?: ServiceProfile;
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
    }

    destroy() {
        if (this.#running)
            this.Stop();

        this.#background = undefined;
        this.#logger = undefined;
        this.#settings = undefined;
    }

    LoadProfile(profile_name?: string) {
        const profile: ServiceProfile = new ServiceProfile(this.#settings!, this.#logger!, profile_name || this.#settings!.get_string('current-profile'));

        profile.load();
        if (this.#profile) {
            this.#profile.destroy(this.#background?.get_string('picture-uri'));
            this.#profile = undefined;
        }
        this.#profile = profile;
        this.#set_wallpaper(this.#profile.next());
        // reset the timer since the wallpaper was just changed
        if (this.#timer) {
            this.#destroy_timer();
            this.#create_timer();
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
        this.#create_timer();
        this.#current_profile_changed_id = this.#settings!.connect('changed::current-profile', () => this.LoadProfile(this.#settings!.get_string('current-profile')));
        this.#rotation_changed_id = this.#settings!.connect('changed::rotation', () => this.#restart_timer());
        this.emit('Start');
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
    }

    #restart_timer() {
        this.#destroy_timer();
        this.#create_timer();
    }

    #set_wallpaper(uri: string) {
        this.#background!.set_string('picture-uri', uri);
        this.#background!.set_string('picture-uri-dark', uri);
        this.emit('Changed', uri);
    }
}
