import GObject from "gi://GObject";
import Gio from "gi://Gio";
import {SettingsAllowedMimeTypesType, SettingsProfileItemType, SettingsProfileType} from "../../common/settings.js";
import GLib from "gi://GLib";
import ServiceProfileQueue from "./queue.js";
import ServiceProfileWallpaper from "./wallpaper.js";

export const MAX_QUEUE_LENGTH = 5;

export namespace ServiceProfile {
    export interface ConstructorProps {
        profile_name: string;
    }
}

export default class ServiceProfile extends GObject.Object {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerServiceProfile",
            Properties: {
                "loaded": GObject.param_spec_boolean(
                    "loaded", "Loaded",
                    "Check if the profile is loaded",
                    false, GObject.ParamFlags.READABLE
                ),
                "preview": GObject.param_spec_string(
                    "preview", "Preview",
                    "Preview of the next wallpaper in the queue",
                    null, GObject.ParamFlags.READABLE
                ),
                "profile_name": GObject.param_spec_string(
                    "profile_name", "Profile name",
                    "The profile name that this object represents",
                    null, GObject.ParamFlags.READABLE
                ),
            },
            Signals: {
                "loaded": { param_types: [GObject.TYPE_INT, GObject.TYPE_STRING] },
                "unloaded": {},
            },
        }, this);
    }

    #history: ServiceProfileQueue;
    #loaded: boolean;
    #logger?: Console;
    #monitors: Gio.FileMonitor[];
    #profile?: SettingsProfileItemType[];
    readonly #profile_name: string;
    #queue: ServiceProfileQueue;
    #sequence: number;
    #settings?: Gio.Settings;
    #wallpapers: string[];

    get loaded() {
        return this.#loaded;
    }

    get preview() {
        if (!this.#loaded)
            return null;

        return this.#queue.get_item(0)?.wallpaper || null;
    }

    get profile_name() {
        return this.#profile_name;
    }

    constructor(settings: Gio.Settings, logger: Console, properties?: Partial<ServiceProfile.ConstructorProps>) {
        const { profile_name } = properties || {};

        if (!profile_name)
            throw new TypeError("Profile name is required");

        super();

        this.#loaded = false;
        this.#logger = logger;
        this.#settings = settings;
        this.#monitors = [];
        this.#profile_name = profile_name;
        this.#queue = new ServiceProfileQueue();
        this.#history = new ServiceProfileQueue();
        this.#sequence = 0;
        this.#wallpapers = [];
    }

    destroy(current_uri?: string) {
        this.unload(current_uri);
        this.#logger = undefined;
        this.#settings = undefined;
    }

    fill_queue() {
        const random = this.#settings!.get_boolean('random');

        // This isn't a bad thing, just a prevention from overloading anything
        if (this.#queue.get_n_items() >= MAX_QUEUE_LENGTH) {
            this.#logger?.debug(`the queue for ${this.#profile_name} already has ${this.#queue.get_n_items()} wallpapers and is over the limit`);
            return;
        }

        do {
            let wallpaper: string | undefined;

            if (random) {
                do {
                    wallpaper = this.#wallpapers[Math.floor(Math.random() * this.#wallpapers.length)];
                    const [in_history, _history_position] = this.#history.find(wallpaper);
                    const [in_queue, _queue_position] = this.#queue.find(wallpaper);

                    if (in_history && (this.#wallpapers.length >= 128 || this.#history.next === wallpaper)) {
                        this.#logger?.debug(`Wallpaper ${wallpaper} exists in history`);
                        wallpaper = undefined;
                    } else if (in_queue && this.#wallpapers.length > MAX_QUEUE_LENGTH) {
                        this.#logger?.debug(`Wallpaper ${wallpaper} is already in the queue`);
                        wallpaper = undefined;
                    }
                } while (wallpaper === undefined);
            } else {
                wallpaper = this.#wallpapers[this.#sequence++];
                if (this.#sequence >= this.#wallpapers.length) {
                    this.#sequence = 0;
                }
            }

            this.#queue.append(wallpaper);
        } while (this.#queue.get_n_items() < MAX_QUEUE_LENGTH);
    }

    load() {
        const profiles: SettingsProfileType = this.#settings!.get_value("profiles").deepUnpack<SettingsProfileType>();

        if (!(this.#profile_name in profiles))
            throw new ReferenceError(`Profile ${this.#profile_name} does not exist`);

        this.#profile = profiles[this.#profile_name];
        // load each item in the profile - this is the top level
        this.#profile.forEach(item => this.#load_uri(item[0], item[1], true));
        // attempt to reload when the profiles change
        this.#settings!.connect('notify::profiles', this.#reload.bind(this));

        if (this.#settings!.get_boolean('remember-profile-state'))
            this.#restore_profile_state();

        // prepare the queue!
        this.fill_queue();
        this.#loaded = true;
        this.notify('loaded');
        this.emit('loaded', this.#wallpapers.length, this.#queue.next);
    }

    next(current?: string) {
        if (!this.#loaded)
            throw new Error(`Profile ${this.#profile_name} is not loaded`);


        const wallpaper = this.#queue.dequeue().wallpaper;
        this.fill_queue();
        this.notify('preview');

        if (current)
            this.#history.insert(0, current);

        return wallpaper;
    }

    previous(current?: string) {
        if (!this.#loaded)
            throw new Error(`Profile ${this.#profile_name} is not loaded`);

        const wallpaper = this.#history.dequeue().wallpaper;

        if (current) {
            this.#queue.insert(0, current);
            this.notify('preview');
        }

        return wallpaper;
    }

    unload(current_uri?: string) {
        if (this.#settings!.get_boolean('remember-profile-state'))
            this.#save_profile_state(current_uri);

        this.#profile = undefined;
        this.#monitors.forEach(monitor => monitor.cancel());
        this.#monitors = [];
        this.#wallpapers = [];
        this.#loaded = false;
        this.notify('loaded');
        this.emit('unloaded');
    }

    #directory_changed(_monitor: Gio.FileMonitor, file: Gio.File, other_file: Gio.File, event_type: Gio.FileMonitorEvent, recursive: boolean) {
        if (event_type === Gio.FileMonitorEvent.CREATED) {
            this.#load_uri(file.get_uri(), recursive);
        } else if (event_type === Gio.FileMonitorEvent.DELETED) {
            const uri = file.get_uri();
            const index = this.#wallpapers.indexOf(uri);

            if (index >= 0) {
                this.#wallpapers.splice(index, 1);
                this.#logger?.debug(`Removed wallpaper ${uri} from ${this.#profile_name}`);
            }
        }
    }

    #load_directory(directory: Gio.File, recursive: boolean) {
        try {
            const cancelable = new Gio.Cancellable(),
                monitor = directory.monitor_directory(Gio.FileMonitorFlags.NONE, cancelable);

            monitor.connect('changed', (_monitor: Gio.FileMonitor, file: Gio.File, other_file: Gio.File, event_type: Gio.FileMonitorEvent) => this.#directory_changed(_monitor, file, other_file, event_type, recursive));
            this.#monitors.push(monitor);
        } catch (e) {
            this.#logger?.warn(`Failed to create monitor for ${directory.get_uri()} on ${this.#profile_name}`);
        }

        try {
            const enumerator = directory.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
            let item: Gio.FileInfo | null;

            while ((item = enumerator.next_file(null)) !== null) {
                const child = directory.resolve_relative_path(item.get_name());
                if (child)
                    this.#load_uri(child.get_uri(), recursive);
            }
        } catch (e) {
            this.#logger?.warn(`Failed to enumerate children of ${directory.get_uri()} for ${this.#profile_name}`);
        }
    }

    #load_uri(uri: string, recursive: boolean, top_level: boolean = false) {
        const allowed_mime_types = this.#settings!.get_value("allowed-mime-types").deepUnpack<SettingsAllowedMimeTypesType>();

        try {
            const location = Gio.File.new_for_uri(uri);
            const info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
            const content_type = info.get_content_type();

            if (info.get_file_type() === Gio.FileType.DIRECTORY && (recursive || top_level)) {
                this.#load_directory(location, recursive);
            } else if (info.get_file_type() === Gio.FileType.REGULAR && content_type && allowed_mime_types.includes(content_type)) {
                const uri = location.get_uri();

                if (uri in this.#wallpapers) {
                    this.#logger?.debug(`Skipping duplicate ${uri} for ${this.#profile_name}`);
                    return;
                }

                this.#wallpapers.push(uri);
                this.#logger?.debug(`Added ${uri} to ${this.#profile_name}`);
            } else {
                this.#logger?.debug(`Skipped over unsupported mime ${info.get_content_type()} for ${uri}`);
            }
        } catch (e) {
            return;
        }
    }

    #reload() {
        const profiles = this.#settings!.get_value("profiles").deepUnpack<SettingsProfileType>();

        if (profiles[this.#profile_name] !== this.#profile) {
            this.unload();
            this.load();
        }
    }

    #restore_profile_state() {
        let profile_states = this.#settings!.get_value("profile-states").deepUnpack<{[name: string]: string[]}>();

        if (!(this.#profile_name in profile_states))
            return;

        const state = profile_states[this.#profile_name];
        for (let i = 0; i < state.length && i < MAX_QUEUE_LENGTH; ++i) {
            this.#queue.insert(i, new ServiceProfileWallpaper(state[i]));
        }
        delete profile_states[this.#profile_name];
        this.#settings!.set_value("profile-states", new GLib.Variant('a{sas}', profile_states));
    }

    #save_profile_state(current_uri?: string) {
        let profile_states = this.#settings!.get_value("profile-states").deepUnpack<{[name: string]: string[]}>();
        const n_items = this.#queue.get_n_items();

        profile_states[this.#profile_name] = (current_uri)? [current_uri] : [];
        for (let i = 0; i < n_items && i < MAX_QUEUE_LENGTH; i++) {
            const item = this.#queue.get_item(i);
            if (item)
                profile_states[this.#profile_name].push(item.wallpaper);
        }
        this.#settings!.set_value("profile-states", new GLib.Variant('a{sas}', profile_states));
    }
}
