const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Signals = imports.signals;

const debug = Me.imports.utils.debug;
const MAX_QUEUE_LENGTH = 100;

/*const DeskChangerProfileHistory = new Lang.Class({
    Name: 'DeskChangerProfileHistory',
    Extends: Array,

    append: function (value) {
        this.parent(value);
        while (this.length > MAX_QUEUE_LENGTH) {
            // TODO debug output
            this.pop();
        }
    },
});*/

var DeskChangerProfileError = new Lang.Class({
    Name: 'DeskChangerProfileError',

    _init: function(message, profile=null) {
        this.message = message;
        this.profile = profile;
    }
});


var DeskChangerProfileErrorNoWallpaper = Lang.Class({
    Name: 'DeskChangerProfileErrorNoWallpaper',
    Extends: DeskChangerProfileError,

    _init: function (num_locations, profile) {
        this.parent(_('no wallpapers loaded from %d locations in profile %s'.format(num_locations, profile.profile_name)), profile);
    }
});


const DeskChangerProfileBase = new Lang.Class({
    Name: 'DeskChangerProfileBase',
    Abstract: true,

    /**
     *
     * @param profile_name
     * @param settings DeskChangerSettings
     * @private
     */
    _init: function (key, settings) {
        this._key = key;
        this._key_normalized = key.replace('-', '_');
        this._settings = settings;
        this._profile_name = this._settings[this._key_normalized];
        this._handler_profiles_id = null;
        this._history = []; //new DeskChangerProfileHistory();
        this._monitors = [];
        this._queue = [];
        this._sequence = 0;
        this._wallpapers = [];

        if (!this.hasOwnProperty('_background')) {
            throw 'must have property _background';
        }

        this._profile_changed_id = this._settings.connect('changed::' + key, Lang.bind(this, this._profile_changed));
    },

    destroy: function () {
        if (this._handler_profiles_id) {
            this._settings.disconnect(this._handler_profiles_id);
        }

        if (this._profile_changed_id) {
            this._settings.disconnect(this._profile_changed_id);
        }

        this.unload();
    },

    load: function () {
        let profile = null;

        // Ensure we unload first, resetting all our internals
        this.unload();

        if (!this._settings.profiles.hasOwnProperty(this.profile_name)) {
            throw 'profile %s does not exist'.format(this.profile_name);
        }

        debug('loading profile %s'.format(this.profile_name));
        profile = this._settings.profiles[this.profile_name];
        profile.forEach(Lang.bind(this, function (item) {
            let [uri, recursive] = item;
            this._load_uri(uri, recursive, true);
        }));

        if (this._wallpapers.length === 0) {
            throw new DeskChangerProfileErrorNoWallpaper(profile.length, this);
        } else if (this._wallpapers.length === 1) {
            throw new DeskChangerProfileError(_('only one wallpaper is loaded for %s, rotation is disabled'.format(this.profile_name)), this);
        } else if (this._wallpapers.length < MAX_QUEUE_LENGTH) {
            debug('unable to guarantee random rotation - wallpaper count is under %d(%d)'.format(MAX_QUEUE_LENGTH, this._wallpapers.length));
        }

        this._wallpapers.sort();
        if (this._settings.remember_profile_state) {
            this.restore_state();
        }

        // Now load up the queue
        this._fill_queue();
        debug('profile %s loaded with %d wallpapers'.format(this.profile_name, this._wallpapers.length));

        if (this._settings.auto_rotate) {
            this.next(false);
        }
    },

    next: function (_current = true) {
        let current = (_current)? this._background.get_string('picture-uri') : null,
            wallpaper = this._queue.pop();

        if (current) {
            this._history.push(current);
        }

        this._set_wallpaper(wallpaper);
        this._fill_queue();
        return wallpaper;
    },

    prev: function () {
        let wallpaper;

        if (this._history.length === 0) {
            throw new DeskChangerProfileError(_('No more wallpapers available in history'), this);
        }

        wallpaper = this._history.pop();
        this._queue.unshift(this._background.get_string('picture-uri'));
        this.emit('preview', this._queue[0]);
        this._set_wallpaper(wallpaper);
        return wallpaper;
    },

    unload: function () {
        this._monitors.forEach(function (monitor) {
            monitor.cancel();
        });

        this._history = []; //new DeskChangerProfileHistory();
        this._monitors = [];
        this._queue = [];
        this._sequence = 0;
        this._wallpapers = [];
    },

    get preview() {
        if (this._queue.length) {
            return this._queue[0];
        }

        return null;
    },

    get profile_name() {
        return this._profile_name;
    },

    _file_changed: function () {
    },

    _fill_queue: function () {
        let wallpaper;

        if (this._queue.length > 0) {
            // Queue only needs one item at minimum
            debug('wallpaper queue already has %d in it, skipping'.format(this._queue.length));
            this.emit('preview', this._queue[0]);
            return;
        }

        if (this._settings.random) {
            do {
                wallpaper = this._wallpapers[Math.floor(Math.random() * this._wallpapers.length)];

                if (wallpaper in this._history && (this._wallpapers.length >= MAX_QUEUE_LENGTH || this._history[0] === wallpaper)) {
                    // Already shown too recently, try again
                    wallpaper = null;
                } else if (wallpaper in this._queue && (this._wallpapers.length >= MAX_QUEUE_LENGTH || this._queue.length < this._wallpapers.length)) {
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

        this._queue.push(wallpaper);
        this.emit('preview', wallpaper);
        debug('added %s to the queue'.format(wallpaper));
    },

    _load_children: function (location, recursive) {
        let enumerator, item;

        try {
            enumerator = location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            debug('failed to load %s from profile %s (%s)'.format(location.get_uri(), this.profile_name, e));
            return;
        }

        while ((item = enumerator.next_file(null)) !== null) {
            let child = location.resolve_relative_path(item.get_name());
            if (child) {
                this._load_uri(child.get_uri(), recursive);
            }
        }
    },

    _load_uri: function (uri, recursive, top_level=false) {
        let location = null,
            info = null;

        debug('loading uri %s%s'.format(uri, recursive? ' recursively' : ''));

        try {
            location = Gio.File.new_for_uri(uri);
            info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            debug('failed to get info for %s on profile %s (%s)'.format(uri, this.profile_name, e));
            return;
        }

        if (info.get_file_type() === Gio.FileType.DIRECTORY && (recursive || top_level)) {
            let monitor = location.monitor_directory(Gio.FileMonitorFlags.NONE, new Gio.Cancellable());
            monitor.connect('changed', Lang.bind(this, this._file_changed));
            this._monitors.push(monitor);
            this._load_children(location, recursive);
        } else if (info.get_file_type() === Gio.FileType.REGULAR && this._settings.allowed_mime_types.includes(info.get_content_type())) {
            if (location.get_uri() in this._wallpapers) {
                debug('ignoring duplicate file %s on profile %s'.format(location.get_uri(), this.profile_name));
                return;
            }

            this._wallpapers.push(location.get_uri());
        } else {
            debug('skipping %s(%s)'.format(location.get_uri(), info.get_content_type()));
        }
    },

    _profile_changed: function (settings, key) {
        this.unload();
        this._profile_name = settings[key];
        this.load();
    },

    _set_wallpaper: function (wallpaper) {
        debug('setting wallpaper for %s(%s) to %s'.format(this.__name__, this.profile_name, wallpaper));
        this._background.set_string('picture-uri', wallpaper);
    },
});

Signals.addSignalMethods(DeskChangerProfileBase.prototype);


var DeskChangerProfileDesktop = new Lang.Class({
    Name: 'DeskChangerProfileDesktop',
    Extends: DeskChangerProfileBase,

    _init: function (settings) {
        this._background = Gio.Settings.new('org.gnome.desktop.background');
        this.parent('current-profile', settings);
    },

    restore_state: function () {
        if (this._settings.profile_state.hasOwnProperty(this.profile_name)) {
            this._queue = this._settings.profile_state[this.profile_name];
            delete this._settings.profile_state[this.profile_name];
            debug('restored state of profile %s'.format(this.profile_name));
            if (this._queue.length > 0) {
                this.emit('preview', this._queue[0]);
            }
        }
    },

    save_state: function () {
        if (this._queue.length === 0) {
            debug('ERROR: failed to save state of profile %s because queue is empty'.format(this.profile_name));
            return;
        } else if (this._settings.profile_state.hasOwnProperty(this.profile_name)) {
            debug('overwriting state of profile %s'.format(this.profile_name));
        }

        this._settings.profile_state[this.profile_name] = this._queue;
        debug('saved state of profile %s'.format(this.profile_name));
    },

    _profile_changed: function (settings, key) {
        if (this._settings.remember_profile_state) {
            this.save_state();
        }

        this.parent(settings, key);
    },
});


var DeskChangerProfileLockscreen = new Lang.Class({
    Name: 'DeskChangerProfileLockscreen',
    Extends: DeskChangerProfileBase,

    _init: function (settings) {
        this._background = Gio.Settings.new('org.gnome.desktop.screensaver');
        this.parent(settings.lockscreen_profile, settings);
    },
});
