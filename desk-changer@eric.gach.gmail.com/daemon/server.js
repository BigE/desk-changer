#!/usr/bin/env gjs

'use strict';

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

if (!globalThis.deskchanger) {
// Find the root datadir of the extension
    function get_datadir() {
        let m = /@(.+):\d+/.exec((new Error()).stack.split('\n')[1]);
        return Gio.File.new_for_path(m[1]).get_parent().get_parent().get_path();
    }

    imports.searchPath.unshift(get_datadir());
    imports._deskchanger;
}

const Interface = imports.daemon.interface;
const Profile = imports.daemon.profile;
const Timer = imports.daemon.timer;
const Utils = imports.common.utils;
const _ = deskchanger._;

var Server = GObject.registerClass({
    GTypeName: 'DeskChangerDaemonServer',
    Properties: {
        'preview': GObject.ParamSpec.string(
            'preview',
            'Preview',
            _('The next wallpaper in queue'),
            GObject.ParamFlags.READABLE,
            null
        ),
        'running': GObject.ParamSpec.boolean(
            'running',
            'Running',
            _('Check if the daemon is running'),
            GObject.ParamFlags.READABLE,
            false
        ),
    },
    Signals: {
        'Running': { param_types: [GObject.TYPE_BOOLEAN] },
    },
},
class Server extends Gio.Application {
    _init() {
        this._background = new Gio.Settings({'schema': 'org.gnome.desktop.background'});
        this._current_profile_changed_id = null;
        this._dbus_id = null;
        this._interval_changed_id = null;
        this._profile = new Profile.Profile();
        this._preview_id = this._profile.connect('preview', (object, uri) => {
            this.notify('preview');
            this.emit_signal('Preview', new GLib.Variant('(s)', [uri]));
        });
        this._rotation_changed_id = null;
        this._running = false;
        this._timer = null;

        super._init({
            application_id: Interface.APP_ID,
            flags: Gio.ApplicationFlags.IS_SERVICE |
                   Gio.ApplicationFlags.HANDLES_OPEN |
                   Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
        });

        this.add_main_option('debug', 'd'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE, _('Enable debugging'), null);
        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE, _('Show release version'), null);
    }

    get preview() {
        return this._profile.preview;
    }

    get running() {
        return this._running;
    }

    emit_signal(signal, variant) {
        let connection = this.get_dbus_connection();

        if (connection) {
            deskchanger.debug(`DBUS::${signal}(${variant.deepUnpack()})`);
            connection.emit_signal(null, Interface.APP_PATH, Interface.APP_ID, signal, variant);
        }
    }

    loadprofile(profile=null) {
        let _profile = this._profile.loaded;

        if (_profile) {
            this._profile.unload(this._background.get_string('picture-uri'));
        }

        if (this._profile.load(profile) === true) {
            this._set_wallpaper(this._profile.next());
            // reset the interval timer - since the wallpaper was just changed
            // it should start over.
            if (this._timer && this._interval_changed_id) {
                this._destroy_timer();
                this._create_timer();
            }
            return true;
        }

        if (_profile) {
            this._profile.load(_profile);
        }

        return false;
    }

    next() {
        let wallpaper = this._profile.next(this._background.get_string('picture-uri'));
        this._set_wallpaper(wallpaper);
        return wallpaper;
    }

    prev() {
        let wallpaper = this._profile.prev(this._background.get_string('picture-uri'));
        this._set_wallpaper(wallpaper);
        return wallpaper;
    }

    start() {
        if (this._running) {
            deskchanger.debug('daemon is already started');
            return false;
        }

        this.loadprofile();
        this._create_timer();
        this._rotation_changed_id = deskchanger.settings.connect('changed::rotation', () => {
            this._destroy_timer();
            this._create_timer();
        });
        this._current_profile_changed_id = deskchanger.settings.connect('changed::current-profile', () => {
            this.loadprofile();
        });
        this._running = true;
        this.notify('running');
        this.emit_signal('Running', new GLib.Variant('(b)', [this.running]));
        return true;
    }

    stop() {
        if (!this._running) {
            deskchanger.debug('cannot stop, daemon isn\'t running');
            return false;
        }

        this._destroy_timer();

        if (this._current_profile_changed_id) {
            deskchanger.settings.disconnect(this._current_profile_changed_id);
            this._current_profile_changed_id = null;
        }

        if (this._rotation_changed_id) {
            deskchanger.settings.disconnect(this._rotation_changed_id);
            this._rotation_changed_id = null;
        }

        this._profile.unload(this._background.get_string('picture-uri'));
        this._running = false;
        this.notify('running');
        this.emit_signal('Running', new GLib.Variant('(b)', [this.running]));
        return true;
    }

    vfunc_dbus_register(connection, object_path) {
        if (super.vfunc_dbus_register(connection, object_path)) {
            deskchanger.debug(`attempting to register object on dbus: ${object_path}`);

            try {
                this._dbus_id = connection.register_object(
                    object_path,
                    deskchanger.dbusinfo.lookup_interface(Interface.APP_ID),
                    (connection, sender, object_path, interface_name, method_name, parameters, invocation) => {
                        parameters = parameters.unpack();
                        deskchanger.debug(`[DBUS.call] ${interface_name}.${method_name}(${parameters})`)

                        if (!this._running && ['quit', 'start'].indexOf(method_name.toLowerCase()) === -1) {
                            invocation.return_dbus_error(`${interface_name}.${method_name}`, 'daemon must be started first');
                            return;
                        }

                        try {
                            this[`_dbus_call_${method_name.toLowerCase()}`](invocation, ...parameters);
                        } catch (e) {
                            deskchanger.error(e, `DBUS::call ${e.message}`);
                            invocation.return_dbus_error(`${interface_name}.${method_name}`, e.message);
                        }
                    },
                    this._handle_dbus_get.bind(this),
                    () => {},
                );

                deskchanger.debug(`successfully registered object on dbus: ${object_path}(${this._dbus_id})`);
                return true;
            } catch (e) {
                deskchanger.error(e, `failed to register object on dbus: ${object_path}`);
            } finally {
                if (this._dbus_id === 0) {
                    this._dbus_id = null;
                }
            }
        }

        return false;
    }

    vfunc_dbus_unregister(connection, object_path) {
        if (this._dbus_id) {
            deskchanger.debug(`unregistering object from dbus: ${object_path}(${this._dbus_id})`);
            connection.unregister_object(this._dbus_id);
        }

        this._dbus_id = null;
    }

    vfunc_handle_local_options(options) {
        if (options.contains('version')) {
            print(`${deskchanger.app_id} ${deskchanger.metadata.version}`);
            return 0;
        }

        if (options.contains('debug')) {
            deskchanger.force_debug = true;
        }

        return -1;
    }

    vfunc_shutdown() {
        deskchanger.debug('vfunc_shutdown');
        
        if (this._running) {
            this.stop();
        }

        if (this._preview_id) {
            this._profile.disconnect(this._preview_id);
        }

        this._profile.destroy();
        super.vfunc_shutdown();
    }

    vfunc_startup() {
        deskchanger.debug('vfunc_startup');
        super.vfunc_startup();

        // Keep us open and running... we are a daemon
        this.hold();

        if (deskchanger.settings.auto_start) {
            this.start();
        }
    }

    _create_timer() {
        if (deskchanger.settings.rotation === 'interval') {
            this._timer = new Timer.Interval(deskchanger.settings.interval, this.next.bind(this));
            this._interval_changed_id = deskchanger.settings.connect('changed::interval', () => {
                this._timer.destroy();
                this._timer = new Timer.Interval(deskchanger.settings.interval, this.next.bind(this));
            });
        } else if (deskchanger.settings.rotation === 'hourly') {
            this._timer = new Timer.Hourly(this.next.bind(this));
        }
    }

    _destroy_timer() {
        if (this._timer) {
            if (this._interval_changed_id) {
                deskchanger.settings.disconnect(this._interval_changed_id);
                this._interval_changed_id = null;
            }

            this._timer.destroy();
            this._timer = null;
        }
    }

    _dbus_call_loadprofile(invocation, profile) {
        invocation.return_value(new GLib.Variant('(b)', [this.loadprofile(profile.get_string()[0])]));
    }

    _dbus_call_next(invocation) {
        invocation.return_value(new GLib.Variant('(s)', [this.next(), ]));
    }

    _dbus_call_prev(invocation) {
        invocation.return_value(new GLib.Variant('(s)', [this.prev(), ]))
    }

    _dbus_call_quit(invocation) {
        invocation.return_value(null);
        this.quit();
    }

    _dbus_call_start(invocation) {
        invocation.return_value(new GLib.Variant('(b)', [this.start(), ]));
    }

    _dbus_call_stop(invocation) {
        invocation.return_value(new GLib.Variant('(b)', [this.stop(), ]));
    }

    _handle_dbus_get(connection, sender, object_path, interface_name, property_name) {
        deskchanger.debug(`DBUS::getProperty(${property_name})`);
        switch (property_name.toLowerCase()) {
            case 'history':
                return new GLib.Variant('as', []);

            case 'queue':
                return new GLib.Variant('as', []);

            case 'preview':
                return new GLib.Variant('s', this.preview);

            case 'running':
                return new GLib.Variant('b', this.running);
        }

        deskchanger.debug(`unknown property ${interface_name}.${property_name}`)
        return null;
    }

    _set_wallpaper(uri) {
        deskchanger.debug(`setting wallpaper to ${uri}`);
        this._background.set_string('picture-uri', uri);
        this.emit_signal('Changed', new GLib.Variant('(s)', [uri]));
    }
}
);

(new Server()).run([imports.system.programInvocationName].concat(ARGV));
