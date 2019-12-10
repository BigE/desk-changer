const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Utils = Me.imports.utils;

const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const MAX_QUEUE_LENGTH = 128;


var ProfileError = GObject.registerClass({
    Properties: {
        'caller': GObject.ParamSpec.string('caller', 'Caller', 'Caller of the exception',
            GObject.ParamFlags.CONSTRUCT | GObject.ParamFlags.READABLE, ''),
        'message': GObject.ParamSpec.string('message', 'Message', 'Message of the exception thrown',
            GObject.ParamFlags.CONSTRUCT | GObject.ParamFlags.READABLE, ''),
    },
},
class DeskChangerProfileError extends GObject.Object {
    _init(message) {
        super._init();
        let args = Array.from(...arguments).slice(1);

        this._caller = Utils.getCaller();
        this._message = message.format(...args);
    }

    get caller() {
        return this._caller;
    }

    get message() {
        return this._message;
    }
});

var Profile = GObject.registerClass(
{
    Abstract: true,
    Properties: {
        'loaded': GObject.ParamSpec.boolean('loaded', 'Loaded', 'Check if the profile is currently loaded',
            GObject.ParamFlags.CONSTRUCT | GObject.ParamFlags.READABLE, false),
        'preview': GObject.ParamSpec.string('preview', 'Preview', 'URI to the next wallpaper to be displayed',
            GObject.ParamFlags.CONSTRUCT | GObject.ParamFlags.READABLE, ''),
    },
    Signals: {
        'loaded': { param_types: [GObject.TYPE_BOOLEAN] },
        'preview': { param_types: [GObject.TYPE_STRING] },
    },
},
class DeskChangerProfile extends GObject.Object {
    _init(settings, profile_key, params={}) {
        if (this._background === undefined)
            throw new ProfileError('no background setting is defined');

        this._loaded = false;
        this._monitors = [];
        this._profile = null;
        this._profile_key = profile_key;
        this._profile_changed_id = null;
        this._queue = new ProfileQueue();
        this._history = new ProfileQueue();
        this._sequence = 0;
        this._settings = settings;
        this._wallpapers = [];
        this._profile_changed_id = settings.connect(`changed::${profile_key}`, () => {
            this.reload();
        });
        super._init(params);
    }

    get history() {
        return this._history;
    }

    get loaded() {
        return this._loaded;
    }

    get preview() {
        return this._queue.preview;
    }

    destroy() {
        if (this._loaded)
            this.unload();

        if (this._profile_changed_id) {
            this._settings.disconnect(this._profile_changed_id);
        }

        super.destroy();
    }

    fill_queue() {
        let wallpaper;

        if (this._queue.length > 0) {
            Utils.debug(`queue already has ${this._queue.length} wallpapers, skipping fill`);
            this._emit_preview(this._queue.preview);
            return;
        }

        if (this._settings.get_boolean('random')) {
            do {
                wallpaper = this._wallpapers[Math.floor(Math.random() * this._wallpapers.length)];

                if (this._background.get_string('picture-uri') === wallpaper) {
                    // current wallpaper. oh noes!
                    wallpaper = null;
                } else if (this._history.exists(wallpaper) && (this._wallpapers.length >= MAX_QUEUE_LENGTH || this._history.preview === wallpaper)) {
                    // Already shown too recently, try again
                    wallpaper = null;
                } else if (this._queue.exists(wallpaper) && (this._wallpapers.length >= MAX_QUEUE_LENGTH || this._queue.length < this._wallpapers.length)) {
                    // Already in the queue, try again
                    wallpaper = null;
                }
            } while (wallpaper === null);
        } else {
            wallpaper = this._wallpapers[this._sequence++];
            if (this._sequence > this._wallpapers.length) {
                this._sequence = 0;
            }
        }

        this._queue.enqueue(wallpaper);
        this._emit_preview(this._queue.preview);
    }

    load(profile=null) {
        this._profile = profile || this._settings.get_string(this._profile_key);
        Utils.debug(`loading profile ${this._profile}`);
        let profiles = this._settings.get_value('profiles').deep_unpack();

        if (!this._profile in profiles) {
            Utils.debug(`unable to find profile ${this._profile}`);
            this.unload();
            return false;
        }

        profiles[this._profile].forEach((item) => {
            let [uri, recursive] = item;
            this._load_uri(uri, recursive, true);
        });

        this._loaded = true;
        this.fill_queue();
        Utils.debug(`loaded profile ${this._profile} with ${this._wallpapers.length} wallpapers`);
        this.emit('loaded', this._profile);
        return true;
    }

    next(_current=true, _wallpaper=null) {
        let current = (_current)? this._background.get_string('picture-uri') : null,
            wallpaper = (_wallpaper)? _wallpaper : this._queue.dequeue();

        if (current) {
            this._history.enqueue(current);
        }

        this.fill_queue();
        this._set_wallpaper(wallpaper);
        return wallpaper;
    }

    prev(_current=true, _wallpaper=null) {
        if (this._history.length === 0) {
            return false;
        }

        let current = (_current)? this._background.get_string('picture-uri') : null,
            wallpaper = (_wallpaper)? _wallpaper : this._history.dequeue();

        if (current) {
            this._queue.enqueue(current);
            this._emit_preview(this._queue.preview);
        }

        this._set_wallpaper(wallpaper);
        return wallpaper;
    }

    reload() {
        // don't do anything.. we're not even loaded
        if (!this._loaded) return;

        Utils.debug(`reload profile ${this._profile}`);
        this.unload();
        this.load();
    }

    unload() {
        Utils.debug(`unloading profile ${this._profile}`);

        for (let monitor in this._monitors) {
            this._monitors[monitor].cancel();
            Utils.debug(`cleared monitor ${monitor}`);
        }

        this._monitors = [];
        this._profile = null;
        this._wallpapers = [];
        this._history.clear();
        this._queue.clear();
        this._loaded = false;
        return true;
    }

    _directory_changed(file, other_file, event_type) {
        Utils.debug('_directory_changed');
    }

    _emit_preview(wallpaper) {
        this.emit('preview', wallpaper);
        Utils.debug(`preview(${wallpaper})`);
    }

    _load_location(location, recursive) {
        let enumerator, item;

        try {
            enumerator = location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            Utils.error(e, `failed to load ${location.get_uri()} from profile ${this._profile}`);
            return;
        }

        while ((item = enumerator.next_file(null)) !== null) {
            let child = location.resolve_relative_path(item.get_name());
            if (child) {
                this._load_uri(child.get_uri(), recursive);
            }
        }
    }

    _load_uri(uri, recursive, top=false) {
        let location, info,
            allowed_mimes = this._settings.get_value('allowed-mime-types').deep_unpack();

        Utils.debug(`loading ${uri}${(recursive)? ' recursively' : ''}`);

        try {
            location = Gio.File.new_for_uri(uri);
            info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            Utils.error(e, `failed to get info for ${uri} on profile ${this._profile}`);
            return;
        }

        if (info.get_file_type() === Gio.FileType.DIRECTORY && (recursive || top)) {
            try {
                let monitor = location.monitor_directory(Gio.FileMonitorFlags.NONE, new Gio.Cancellable());
                monitor.connect('changed', this._directory_changed.bind(this));
                this._monitors.push(monitor);
                Utils.debug(`added monitor for ${uri}`);
            } catch (e) {
                Utils.error(e, `failed to set monitor on ${uri}`);
            }

            this._load_location(location, recursive);
        } else if (info.get_file_type() === Gio.FileType.REGULAR && allowed_mimes.includes(info.get_content_type())) {
            if (location.get_uri() in this._wallpapers) {
                Utils.debug(`ignoring duplicate location ${location.get_uri()}`);
                return;
            }

            this._wallpapers.push(location.get_uri());
        } else {
            Utils.debug(`skipping unknown format ${info.get_content_type()}: ${location.get_uri()}`);
        }
    }

    _set_wallpaper(wallpaper) {
        this._background.set_string('picture-uri', wallpaper);
        Utils.debug(`set wallpaper ${wallpaper}`);
    }
}
);

let ProfileQueue = GObject.registerClass({
    Properties: {
        'length': GObject.ParamSpec.uint('length', 'Length', 'The length of the current queue',
            GObject.ParamFlags.READABLE, 0, GLib.MAXUINT32, 0),
        'preview': GObject.ParamSpec.string('preview', 'Preview', 'The uri of the next wallpaper that will be displayed',
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

    get preview() {
        return (this._queue.length > 0)? this._queue[this._queue.length - 1] : undefined;
    }

    all() {
        return this._queue;
    }

    clear() {
        this._queue = [];
        Utils.debug('cleared the queue');
    }

    dequeue() {
        if (this._queue.length === 0) return undefined;
        let uri = this._queue.pop();
        Utils.debug(`removed ${uri} from the queue`);
        return uri;
    }

    enqueue(uri) {
        this._queue.push(uri);
        Utils.debug(`added ${uri} to the queue`);
    }

    exists(uri) {
        return (this._queue.indexOf(uri) >= 0);
    }

    remove(uri) {
        let index = this._queue.indexOf(uri);

        if (index >= 0) {
            this._queue.splice(index, 1);
            Utils.debug(`removed ${uri} from the queue`);
            return true;
        }

        Utils.debug(`unable to remove ${uri} from the queue`);
        return false;
    }

    restore(queue) {
        Utils.debug('restoring the queue state');
        this._queue = queue;
    }
}
);

var DesktopProfile = GObject.registerClass(
class DeskChangerDesktopProfile extends Profile {
    _init(settings, params = {}) {
        this._background = Convenience.getSettings('org.gnome.desktop.background');
        super._init(settings, 'current-profile', params);
    }

    load(profile=null) {
        let _profile = profile || this._settings.current_profile;

        if (this._settings.remember_profile_state && _profile in this._settings.profile_state) {
            Utils.debug(`restoring profile state for ${_profile}`);
            this._queue.restore(this._settings.profile_state[_profile]);
            let profile_state = this._settings.profile_state;
            delete profile_state[_profile];
            this._settings.profile_state = profile_state;
        }

        return super.load(profile);
    }

    unload() {
        if (this._settings.remember_profile_state) {
            Utils.debug(`storing profile state for ${this._profile}`);
            let profile_state = this._settings.profile_state;
            profile_state[this._profile] = [this.preview, this._background.get_string('picture-uri')];
            this._settings.profile_state = profile_state;
        }

        super.unload();
    }
}
);

var LockScreenProfile = GObject.registerClass(
class DeskChangerLockScreenProfile extends Profile {
    _init(settings, params={}) {
        this._background = Convenience.getSettings('org.gnome.desktop.screensaver');
        super._init(settings, 'lockscreen-profile', params);
    }

    get inherit()
    {
        return (!this._settings.lockscreen_profile);
    }

    load(profile=null) {
        if (this.inherit) {
            Utils.debug('lockscreen profile inherits desktop - bailing');
            this._loaded = true;
            return;
        }

        super.load(profile);
    }
}
);
