import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import RotationModes from '../common/rotation_modes.js';
import {SettingsRotationModes} from '../common/settings.js';
import ServiceProfile from './profile/index.js';
import ServiceTimer from './timer/index.js';
import ServiceTimerHourly from './timer/hourly.js';
import ServiceTimerDaily from './timer/daily.js';
import GameMode from './gamemode.js';
import GLib from 'gi://GLib';

export namespace ServiceRunner {
    export interface ConstructorProps {
        logger: Console;
        settings: Gio.Settings;
    }
}

export class ServiceRunner extends GObject.Object {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerService',
                Properties: {
                    'GameMode': GObject.param_spec_boolean(
                        'GameMode',
                        'GameMode',
                        'Check if GameMode is currently enabled',
                        false,
                        GObject.ParamFlags.READABLE
                    ),
                    'History': GObject.param_spec_variant(
                        'History',
                        'History',
                        'History of the currently loaded profile',
                        new GLib.VariantType('as'),
                        null,
                        GObject.ParamFlags.READABLE
                    ),
                    'Profile': GObject.param_spec_string(
                        'Profile',
                        'Profile',
                        'The currently loaded profile name',
                        null,
                        GObject.ParamFlags.READABLE
                    ),
                    'Queue': GObject.param_spec_variant(
                        'Queue',
                        'Queue',
                        'Queue of the currently loaded profile',
                        new GLib.VariantType('as'),
                        null,
                        GObject.ParamFlags.READABLE
                    ),
                    'Preview': GObject.param_spec_string(
                        'Preview',
                        'Preview',
                        'A preview of the upcoming wallpaper in the queue',
                        null,
                        GObject.ParamFlags.READABLE
                    ),
                    'Running': GObject.param_spec_boolean(
                        'Running',
                        'Running',
                        'Check if the daemon is running',
                        false,
                        GObject.ParamFlags.READABLE
                    ),
                },
                Signals: {
                    'Changed': {param_types: [GObject.TYPE_STRING]},
                    'Start': {
                        param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
                    },
                    'Stop': {},
                },
            },
            this
        );
    }

    #background?: Gio.Settings;
    #current_profile_changed_id?: number;
    #gamemode?: GameMode;
    #interval_changed_id?: number;
    #logger?: Console;
    #profile?: ServiceProfile;
    #profile_notify_preview_id?: number;
    #rotation_changed_id?: number;
    #running: boolean;
    #settings?: Gio.Settings;
    #timer?: ServiceTimer;

    get GameMode() {
        return this.#gamemode?.enabled || false;
    }

    get History() {
        return this.#profile?.history || [];
    }

    get Preview() {
        return this.#profile?.preview || null;
    }

    get Profile() {
        return this.#profile?.profile_name || null;
    }

    get Queue() {
        return this.#profile?.queue || [];
    }

    get Running() {
        return this.#running;
    }

    constructor(properties: ServiceRunner.ConstructorProps) {
        const {logger, settings} = properties;

        super();

        this.#logger = logger;
        this.#settings = settings;
        this.#running = false;
        this.#gamemode = new GameMode(this.#logger);
        this.#background = Gio.Settings.new('org.gnome.desktop.background');
    }

    destroy() {
        if (this.#running) this.Stop();

        this.#gamemode?.destroy();
        this.#gamemode = undefined;
        this.#profile?.destroy(this.#background?.get_string('picture-uri'));
        this.#profile = undefined;
        this.#background = undefined;
        this.#logger = undefined;
        this.#settings = undefined;
    }

    Load(profile_name?: string) {
        if (
            profile_name &&
            this.#profile &&
            this.#profile.profile_name === profile_name
        )
            return;

        const profile: ServiceProfile = new ServiceProfile(
            this.#settings!,
            this.#logger!,
            {
                profile_name:
                    profile_name ||
                    this.#settings!.get_string('current-profile'),
            }
        );

        try {
            profile.load();
        } catch (e) {
            profile.destroy();
            if (this.#profile)
                this.#settings?.set_string(
                    'current-profile',
                    this.#profile.profile_name
                );
            throw e;
        }

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
        this.#profile_notify_preview_id = this.#profile.connect(
            'notify::preview',
            () => {
                if (this.#running) {
                    this.notify('Preview');
                }
            }
        );

        if (this.#running) {
            // only set the wallpaper if we're already running
            this.#set_wallpaper(this.#profile.next());
            // restart the timer since the profile/wallpaper was just changed
            this.#restart_timer();
        }
    }

    Next() {
        if (!this.#running || !this.#profile)
            throw new Error(_("Service isn't running"));

        const wallpaper = this.#profile.next(
            this.#background!.get_string('picture-uri')
        );
        this.#set_wallpaper(wallpaper);
        return wallpaper;
    }

    Previous() {
        if (!this.#running || !this.#profile)
            throw new Error("Service isn't running");

        const wallpaper = this.#profile.previous(
            this.#background!.get_string('picture-uri')
        );
        this.#set_wallpaper(wallpaper);
        return wallpaper;
    }

    Restart() {
        this.Stop();
        this.Start();
    }

    Start() {
        if (this.#running) throw new Error(_('Service is already running'));

        if (!this.#profile)
            this.Load();
        else if (this.#profile.loaded === false) {
            try {
                this.#profile.load();
            } catch (e) {
                this.#profile.destroy();
                this.#profile = undefined;
            }
        }

        // create the timer
        this.#create_timer();
        // advance the wallpaper
        this.#set_wallpaper(this.#profile!.next());
        // connect signals to detect changes
        this.#current_profile_changed_id = this.#settings!.connect(
            'changed::current-profile',
            () => {
                this.Load(this.#settings!.get_string('current-profile'));
            }
        );
        this.#rotation_changed_id = this.#settings!.connect(
            'changed::rotation',
            () => {
                this.#restart_timer();
            }
        );
        // fin.
        this.emit('Start', this.#profile?.profile_name, this.#profile?.preview);
    }

    Stop() {
        if (!this.#running) throw new Error(_("Service isn't running"));

        if (this.#current_profile_changed_id) {
            this.#settings!.disconnect(this.#current_profile_changed_id);
            this.#current_profile_changed_id = undefined;
        }

        if (this.#rotation_changed_id) {
            this.#settings!.disconnect(this.#rotation_changed_id);
            this.#rotation_changed_id = undefined;
        }

        this.#destroy_timer();
        // unload the profile to give it a chance to save its state
        this.#profile?.unload(this.#background?.get_string('picture-uri'));
        this.emit('Stop');
    }

    #create_timer() {
        if (this.#timer) throw new TypeError(_('Timer already exists'));

        const rotation = this.#settings!.get_string(
            'rotation'
        ) as SettingsRotationModes;

        if (RotationModes[rotation].timer === 'interval') {
            const interval =
                RotationModes[rotation].interval ||
                this.#settings!.get_int('interval');
            this.#timer = new ServiceTimer(
                interval,
                this.#timer_rotation_callback.bind(this)
            );
            if (rotation === 'interval') {
                this.#interval_changed_id = this.#settings!.connect(
                    'changed::interval',
                    this.#restart_timer.bind(this)
                );
            }
        } else if (RotationModes[rotation].timer === 'daily') {
            this.#timer = new ServiceTimerHourly(
                this.#timer_rotation_callback.bind(this)
            );
        } else if (RotationModes[rotation].timer === 'hourly') {
            this.#timer = new ServiceTimerDaily(
                this.#timer_rotation_callback.bind(this)
            );
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

    #timer_rotation_callback() {
        if (this.#settings?.get_boolean('gamemode-monitor') && this.GameMode) {
            this.#logger?.debug('Skipping timer rotation, GameMode is enabled');
            // skip rotation, but keep the timer running
            return true;
        }

        return Boolean(this.Next());
    }
}
