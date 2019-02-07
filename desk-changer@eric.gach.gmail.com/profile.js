const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Utils = Me.imports.utils;

const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const MAX_QUEUE_LENGTH = 128;


var DeskChangerProfileError = GObject.registerClass({
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

var DeskChangerProfile = GObject.registerClass(
{
    Abstract: true,
    Properties: {
        'loaded': GObject.ParamSpec.boolean('loaded', 'Loaded', 'Check if the profile is currently loaded',
            GObject.ParamFlags.CONSTRUCT | GObject.ParamFlags.READABLE, false),
    },
},
class DeskChangerProfile extends GObject.Object {
    _init(settings, profile_key, params={}) {
        if (this._background === undefined)
            throw new DeskChangerProfileError('no background setting is defined');

        this._loaded = false;
        this._monitors = [];
        this._profile = null;
        this._profile_key = profile_key;
        this._profile_changed_id = null;
        this._queue = new DeskChangerProfileQueue();
        this._history = new DeskChangerProfileQueue();
        this._sequence = 0;
        this._settings = settings;
        this._wallpapers = [];
        super._init(params);
    }

    get loaded() {
        return this._loaded;
    }

    destroy() {
        if (this._loaded)
            this.unload();
    }

    fill_queue() {
        let wallpaper;

        if (this._queue.length > 0) {
            Utils.debug('queue already has %s wallpapers, skipping fill'.format(this._queue.length));
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
        Utils.debug('loading profile %s'.format(this._profile));
        let profiles = this._settings.get_value('profiles').deep_unpack();

        if (!this._profile in profiles) {
            Utils.debug('unable to find profile %s'.format(this._profile));
            this.unload();
            return false;
        }

        if (profile === null) {
            this._profile_changed_id = this._settings.connect('changed::%s'.format(this._profile_key), this.reload.bind(this));
            Utils.debug('connected changed::%s'.format(this._profile_key));
        }

        profiles[this._profile].forEach((item) => {
            let [uri, recursive] = item;
            this._load_uri(uri, recursive, true);
        });

        this._loaded = true;
        this.fill_queue();
        Utils.debug('loaded profile %s with %s wallpapers'.format(this._profile, this._wallpapers.length));
        this.emit('loaded', this._profile);
        return true;
    }

    next(_current=true) {
        let current = (_current)? this._background.get_string('picture-uri') : null,
            wallpaper = this._queue.dequeue();

        if (current) {
            this._history.enqueue(current);
        }

        this.fill_queue();
        this._set_wallpaper(wallpaper);
        return wallpaper;
    }

    prev() {
        let current = (_current)? this._background.get_string('picture-uri') : null,
            wallpaper = this._history.dequeue();

        if (current) {
            this._queue.enqueue(current);
        }

        this._set_wallpaper(wallpaper);
        return wallpaper;
    }

    reload() {
        // don't do anything.. we're not even loaded
        if (!this._loaded) return;

        Utils.debug('reload profile %s'.format(this._profile));
        this.unload();
        this.load();
    }

    unload() {
        Utils.debug('unloading profile %s'.format(this._profile));
        if (this._profile_changed_id) {
            this._settings.disconnect(this._profile_changed_id);
        }

        for (let monitor in this._monitors) {
            monitor.cancel();
            Utils.debug('cleared monitor %s'.format(monitor));
        }

        this._monitors = [];
        this._profile = null;
        this._wallpapers = [];
        this._loaded = false;
        return true;
    }

    _directory_changed(file, other_file, event_type) {
        Utils.debug('_directory_changed');
    }

    _emit_preview(wallpaper) {
        this.emit('preview', wallpaper);
        Utils.debug('preview(%s)'.format(wallpaper));
    }

    _load_location(location, recursive) {
        let enumerator, item;

        try {
            enumerator = location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            Utils.error(e, 'failed to load %s from profile %s', location.get_uri(), this._profile);
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

        Utils.debug('loading %s%s'.format(uri, (recursive)? ' recursively' : ''));

        try {
            location = Gio.File.new_for_uri(uri);
            info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            Utils.error(e, 'failed to get info for %s on profile %s'.format(uri, this._profile));
            return;
        }

        if (info.get_file_type() === Gio.FileType.DIRECTORY && (recursive || top)) {
            try {
                let monitor = location.monitor_directory(Gio.FileMonitorFlags.NONE, new Gio.Cancellable());
                monitor.connect('changed', this._directory_changed.bind(this));
                this._monitors.push(monitor);
                Utils.debug('added monitor for %s'.format(uri));
            } catch (e) {
                Utils.error(e, 'failed to set monitor on %s'.format(uri));
            }

            this._load_location(location, recursive);
        } else if (info.get_file_type() === Gio.FileType.REGULAR && allowed_mimes.includes(info.get_content_type())) {
            if (location.get_uri() in this._wallpapers) {
                Utils.debug('ignoring duplicate location %s'.format(location.get_uri()));
                return;
            }

            this._wallpapers.push(location.get_uri());
        } else {
            Utils.debug('skipping unknown format %s: %s'.format(info.get_content_type(), location.get_uri()));
        }
    }

    _set_wallpaper(wallpaper) {
        this._background.set_string('picture-uri', wallpaper);
        Utils.debug('set wallpaper %s'.format(wallpaper));
    }
}
);

Signals.addSignalMethods(DeskChangerProfile.prototype);

let DeskChangerProfileQueue = GObject.registerClass({
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

    clear() {
        this._queue = [];
        Utils.debug('cleared the queue');
    }

    dequeue() {
        if (this._queue.length === 0) return undefined;
        let uri = this._queue.pop();
        Utils.debug('removed %s from the queue'.format(uri));
        return uri;
    }

    enqueue(uri) {
        this._queue.push(uri);
        Utils.debug('added %s to the queue'.format(uri));
    }

    exists(uri) {
        return (this._queue.indexOf(uri) >= 0);
    }

    remove(uri) {
        let index = this._queue.indexOf(uri);

        if (index >= 0) {
            this._queue.splice(index, 1);
            Utils.debug('removed %s from the queue'.format(uri));
            return true;
        }

        Utils.debug('unable to remove %s from the queue'.format(uri));
        return false;
    }

    restore(queue) {
        Utils.debug('restoring the queue state');
        this._queue = queue;
    }
}
);

var DeskChangerDesktopProfile = GObject.registerClass(
class DeskChangerDesktopProfile extends DeskChangerProfile {
    _init(settings, params = {}) {
        this._background = Convenience.getSettings('org.gnome.desktop.background');
        super._init(settings, 'current-profile', params);
    }
}
);
