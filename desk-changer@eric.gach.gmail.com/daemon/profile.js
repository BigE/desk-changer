'use strict';

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const MAX_QUEUE_LENGTH = 2;

var Error = GObject.registerClass({
    GTypeName: 'DeskChangerProfileError',
    Properties: {
        'caller': GObject.ParamSpec.string('caller', 'Caller', 'Caller of the exception',
            GObject.ParamFlags.READABLE, ''),
        'message': GObject.ParamSpec.string('message', 'Message', 'Message of the exception thrown',
            GObject.ParamFlags.READABLE, ''),
    },
},
class DeskChangerProfileError extends GObject.Object {
    _init(message) {
        super._init();
        let args = Array.from(...arguments).slice(1);

        this._caller = deskchanger.getCaller();
        this._message = message.format(...args);
    }

    get caller() {
        return this._caller;
    }

    get message() {
        return this._message;
    }
}
);

var Profile = GObject.registerClass({
    GTypeName: 'DeskChangerProfile',
    Properties: {
        'loaded': GObject.ParamSpec.boolean('loaded', 'Loaded', 'Boolean property to check if the profile is loaded',
            GObject.ParamFlags.READABLE, false),
        'preview': GObject.ParamSpec.string('preview', 'Preview', 'Next wallpaper in the queue',
            GObject.ParamFlags.READABLE, null),
    },
    Signals: {
        'loaded': { param_types: [GObject.TYPE_BOOLEAN] },
        'preview': { param_types: [GObject.TYPE_STRING] },
    },
},
class DeskChangerProfile extends GObject.Object {
    _init(params={}) {
        this._history = new Queue();
        this._monitors = [];
        this._profile = null;
        this._queue = new Queue();
        this._sequence = 0;
        this._wallpapers = [];

        super._init(params);
        this._profiles_changed_id = null;
    }

    get loaded() {
        return Boolean(this._profile);
    }

    get preview() {
        if (!this.loaded) {
            return null;
        }

        return this._queue.next;
    }

    /**
     * Destroy the current profile object.
     */
    destroy() {
        if (this.loaded) {
            this.unload();
        }

        this._history = null;
        this._queue = null;
    }

    /**
     * Fill the queue up to MAX_QUEUE_LENGTH
     * 
     * This function will fill the queue up to the max length. It will always
     * run once no matter how full the queue is.
     */
    fill_queue() {
        let wallpaper = null;

        if (!this.loaded && this._queue.length >= MAX_QUEUE_LENGTH) {
            deskchanger.debug(`the queue for ${this._profile} already has ${this._queue.length} wallpapers, not adding more to the queue`);
            return;
        }

        deskchanger.debug(`filling queue for ${this._profile}`);
        do {
            if (deskchanger.settings.random) {
                do {
                    wallpaper = this._wallpapers[Math.floor(Math.random() * this._wallpapers.length)];
                    if (this._history.contains(wallpaper) && (this._wallpapers.length >= 128 || this._history.next === wallpaper)) {
                        deskchanger.debug(`wallpaper ${wallpaper} exists in the history, skipping`);
                        wallpaper = null;
                    } else if (this._queue.contains(wallpaper) && this._wallpapers.length > 2) {
                        deskchanger.debug(`wallpaper ${wallpaper} is already in the queue, skipping`);
                        wallpaper = null;
                    }
                } while (wallpaper === null);
            } else {
                wallpaper = this._wallpapers[this._sequence++];
                if (this._sequence >= this._wallpapers.length) {
                    this._sequence = 0;
                }
            }

            this._queue.enqueue(wallpaper);
        } while (this._queue.length < MAX_QUEUE_LENGTH);
    }

    /**
     * Load the specified or current profile
     * 
     * This function will load the profile specified and follow all of the
     * paths. If no profile is specified, it will use the current-profile
     * setting to load a profile.
     * 
     * @param {string} profile Profile name to load
     */
    load(profile=null) {
        let _profile = profile || deskchanger.settings.current_profile,
            profiles = deskchanger.settings.profiles;

        deskchanger.debug(`loading profile ${_profile}`);

        if (!(_profile in profiles)) {
            throw new Error(`unable to load ${_profile} because it doesn't exist`);
        }

        profiles[_profile].forEach((item) => {
            let [uri, recursive] = item;
            this._load_uri(_profile, uri, recursive, true);
        });

        this._profiles_changed_id = deskchanger.settings.connect('changed::profiles', () => {
            let _profiles = deskchanger.settings.profiles;
            if (profiles[_profile] === _profiles[_profile]) {
                return;
            }

            this.reload();
        });

        if (deskchanger.settings.remember_profile_state && _profile in deskchanger.settings.profile_state) {
            deskchanger.debug(`restoring state for profile ${_profile}`);
            let profile_state = deskchanger.settings.profile_state;
            this._queue.restore(profile_state[_profile]);
            delete profile_state[_profile];
            deskchanger.settings.profile_state = profile_state;
        }

        this._profile = _profile;
        this.fill_queue();
        deskchanger.debug(`loaded profile ${this._profile} with ${this._wallpapers.length} wallpapers`);
        this.emit('loaded', true);
        this.emit('preview', this._queue.next);
        return true;
    }

    /**
     * This will return the next wallpaper in the queue
     * 
     * If the current wallpaper is specified, it will be added to the history
     * queue object. The next wallpaper in the queue is returned.
     * 
     * @param {string} current Currently set wallpaper to add to the history
     * @return string|null
     */
    next(current=null) {
        let wallpaper = null;

        if (!this.loaded) {
            throw new Error('cannot load next wallpaper, profile is not loaded');
        }

        if (current) {
            this._history.enqueue(current, true);
        }

        this.fill_queue();
        wallpaper = this._queue.dequeue();
        this.emit('preview', this._queue.next);
        return wallpaper;
    }

    /**
     * This will return the previous wallpaper from the history
     * 
     * If the current wallpaper is specified, it will be moved to the top of
     * the queue. The previous wallpaper in the history will be returned.
     * 
     * @param {string} current Currently set wallpaper to be added to the queue
     * @return string|null
     */
    prev(current=null) {
        let wallpaper = null;

        if (!this.loaded) {
            deskchanger.debug('cannot load prev wallpaper, profile is not loaded');
            return null;
        }

        if (current) {
            this._queue.enqueue(current, true);
        }

        this.emit('preview', this._queue.next);
        wallpaper = this._history.dequeue();
        return wallpaper;
    }

    reload() {
        if (!this.loaded) return false;

        deskchanger.debug(`reloading profile ${this._profile}`)
        this.unload();
        this.load();
        return true;
    }

    unload(current=null) {
        if (deskchanger.settings.remember_profile_state) {
            deskchanger.debug(`storing profile state for ${this._profile}`);
            let profile_state = deskchanger.settings.profile_state;
            profile_state[this._profile] = [this._queue.next, ];
            if (current) {
                profile_state[this._profile].unshift(current);
            }
            deskchanger.settings.profile_state = profile_state;
        }

        if (this._profiles_changed_id) {
            deskchanger.settings.disconnect(this._profiles_changed_id);
        }

        this._history.clear();
        this._queue.clear();
        this._sequence = 0;
        this._wallpapers = [];
        this._profile = null;
        return true;
    }

    /**
     * Triggered when a directory changes.
     * 
     * Here we detect what changed and make updates to the list of wallpapers
     * if neccisary. The only changes that affect the profile are files being
     * removed or added.
     * 
     * @param {string} file The URI of the directory changed
     * @param {string} other_file If applicable, the changed directory
     * @param {Gio.FileMonitorEvent} event_type Event type flag
     */
    _directory_changed(file, other_file, event_type) {
        deskchanger.debug(`detected change of "${event_type}" for ${file}`);
    }

    /**
     * Load a directory and loop through all of its objects.
     * 
     * This is called when a directory is encountered and needs to be loaded
     * into the profile. It will iterate through all objects in the directory
     * and pass them into the loader.
     * 
     * @param {Gio.File} location This is the Gio.File object of the directory
     * @param {boolean} recursive Flag to check if we're loading recursively
     */
    _load_directory(profile, location, recursive) {
        let enumerator, item;

        deskchanger.debug(`attempting to load directory ${location.get_uri()} for profile ${profile}`);

        try {
            enumerator = location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            deskchanger.error(e, `failed to load ${location.get_uri()} from profile ${profile}`);
            return;
        }

        while ((item = enumerator.next_file(null)) !== null) {
            let child = location.resolve_relative_path(item.get_name());
            if (child) {
                this._load_uri(profile, child.get_uri(), recursive);
            }
        }

        deskchanger.debug(`loading of directory ${location.get_uri()} for profile ${profile} is complete`);
    }

    /**
     * Attempts to load a URI into the profile.
     * 
     * This method will attempt to load any URI passed into the profile. The
     * recursive argument tells the the method to recursively go through any
     * directories in encounters and load all the objects in them. The 
     * top_level argument is used for the items that come directly from the
     * profile itself, so if a directory is loaded, all of the contents will be
     * traversed through.
     * 
     * @param {string} uri The URI to attempt to load into the profile
     * @param {boolean} recursive True to make the load recursive
     * @param {boolean} top_level True if we're loading the very top level URI
     */
    _load_uri(profile, uri, recursive, top_level=false) {
        let location, info,
            allowed_mime_types = deskchanger.settings.allowed_mime_types;

        try {
            location = Gio.File.new_for_uri(uri);
            info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            deskchanger.error(e, `failed to load uri ${uri} for profile ${profile}`);
            return;
        }

        if (info.get_file_type() === Gio.FileType.DIRECTORY && (recursive || top_level)) {
            // Attempt to set a monitor on the directory to watch for changes

            try {
                let cancellable = new Gio.Cancellable(),
                    monitor = location.monitor_directory(Gio.FileMonitorFlags.NONE, cancellable);
                monitor.connect('changed', this._directory_changed.bind(this));
                this._monitors.push(monitor);
                deskchanger.debug(`added monitor for ${uri}`);
            } catch (e) {
                deskchanger.error(e, `failed to create monitor on ${uri}`);
            }

            this._load_directory(profile, location, recursive);
        } else if (info.get_file_type() === Gio.FileType.REGULAR && allowed_mime_types.includes(info.get_content_type())) {
            // Load any files that are in our allowed mime types
            if (location.get_uri() in this._wallpapers) {
                deskchanger.debug(`skipping duplicate file ${location.get_uri()} on profile ${profile}`);
                return;
            }

            this._wallpapers.push(location.get_uri());
            deskchanger.debug(`loaded ${location.get_uri()} to profile ${profile}`);
        } else {
            deskchanger.debug(`skipping unknown file type of ${info.get_content_type()} for profile ${profile}`);
        }
    }
}
);

var Queue = GObject.registerClass({
    GTypeName: 'DeskChangerProfileQueue',
    Properties: {
        'length': GObject.ParamSpec.uint('length', 'Length', 'The current size of the queue',
            GObject.ParamFlags.READABLE, 0, GLib.MAXUINT32, 0),
        'next': GObject.ParamSpec.string('next', 'Next', 'The next wallpaper URI in queue',
            GObject.ParamFlags.READABLE, ''),
    }
},
class DeskChangerProfileQueue extends GObject.Object {
    _init(params={}) {
        super._init(params);
        this._queue = [];
    }

    get length() {
        return this._queue.length;
    }

    get next() {
        return this._queue[0];
    }

    all() {
        return this._queue;
    }

    clear() {
        this._queue = [];
        deskchanger.debug('cleared queue object');
    }

    contains(uri) {
        return (this._queue.indexOf(uri) >= 0);
    }

    dequeue() {
        if (this._queue.length === 0) return undefined;
        let uri = this._queue.shift();
        deskchanger.debug(`dequed ${uri} from the queue`);
        return uri;
    }

    enqueue(uri, unshift=false) {
        if (unshift === true) {
            this._queue.unshift(uri);
        } else {
            this._queue.push(uri);
        }

        deskchanger.debug(`added ${uri} to the queue`);
    }

    remove(uri) {
        let index = this._queue.indexOf(uri);

        if (index >= 0) {
            this._queue.splice(index, 1);
            deskchanger.debug(`removed ${uri} from the queue`);
            return true;
        }

        deskchanger.debug(`${uri} was not found in the queue`);
        return false;
    }

    restore(queue) {
        deskchanger.debug('restoring the queue state');
        this._queue = queue;
    }
}
);
