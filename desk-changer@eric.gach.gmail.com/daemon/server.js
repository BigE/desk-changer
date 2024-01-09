#!/usr/bin/env -S gjs -m

'use strict';

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import Interface from "./interface.js";
import * as Profile from "./profile.js";
import * as Timer from "./timer.js";
import * as Logger from "../common/logging.js";

var Server = GObject.registerClass({
    GTypeName: 'DeskChangerDaemonServer',
    Properties: {
        'preview': GObject.ParamSpec.string(
            'preview',
            'Preview',
            'The next wallpaper in queue',
            GObject.ParamFlags.READABLE,
            null
        ),
        'running': GObject.ParamSpec.boolean(
            'running',
            'Running',
            'Check if the daemon is running',
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
        this._background_schema = Gio.SettingsSchemaSource.get_default().lookup('org.gnome.desktop.background', true);
        this._background = new Gio.Settings({schema: 'org.gnome.desktop.background'});
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
            application_id: Interface.app_id,
            flags: Gio.ApplicationFlags.IS_SERVICE |
                   Gio.ApplicationFlags.HANDLES_OPEN |
                   Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
        });

        this.add_main_option('debug', 'd'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE, 'Enable debugging', null);
        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE, 'Show release version', null);
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
            Logger.debug(`DBUS::${signal}(${variant.recursiveUnpack()})`);
            connection.emit_signal(null, Interface.app_path, Interface.app_id, signal, variant);
        }
    }

    loadprofile(profile=null) {
        let _profile = this._profile.profile;

        if (this._profile.loaded) {
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
            Logger.debug('daemon is already started');
            return false;
        }

        this.loadprofile();
        this._create_timer();
        this._rotation_changed_id = Interface.settings.connect('changed::rotation', () => {
            this._destroy_timer();
            this._create_timer();
        });
        this._current_profile_changed_id = Interface.settings.connect('changed::current-profile', () => {
            this.loadprofile();
        });
        this._running = true;
        this.notify('running');
        this.emit_signal('Running', new GLib.Variant('(b)', [this.running]));
        return true;
    }

    stop() {
        if (!this._running) {
            Logger.debug('cannot stop, daemon isn\'t running');
            return false;
        }

        this._destroy_timer();

        if (this._current_profile_changed_id) {
            Interface.settings.disconnect(this._current_profile_changed_id);
            this._current_profile_changed_id = null;
        }

        if (this._rotation_changed_id) {
            Interface.settings.disconnect(this._rotation_changed_id);
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
            Logger.debug(`attempting to register object on dbus: ${object_path}`);

            try {
                this._dbus_id = connection.register_object(
                    object_path,
                    Interface.dbusinfo.lookup_interface(Interface.app_id),
                    (connection, sender, object_path, interface_name, method_name, parameters, invocation) => {
                        parameters = parameters.recursiveUnpack();
                        Logger.debug(`[DBUS.call] ${interface_name}.${method_name}(${parameters})`)

                        if (!this._running && ['quit', 'start'].indexOf(method_name.toLowerCase()) === -1) {
                            invocation.return_dbus_error(`${interface_name}.${method_name}`, 'daemon must be started first');
                            return;
                        }

                        try {
                            this[`_dbus_call_${method_name.toLowerCase()}`](invocation, ...parameters);
                        } catch (e) {
                            Logger.error(e, `DBUS::call ${e.message}`);
                            invocation.return_dbus_error(`${interface_name}.${method_name}`, e.message);
                        }
                    },
                    this._handle_dbus_get.bind(this),
                    () => {},
                );

                Logger.debug(`successfully registered object on dbus: ${object_path}(${this._dbus_id})`);
                return true;
            } catch (e) {
                Logger.error(e, `failed to register object on dbus: ${object_path}`);
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
            Logger.debug(`unregistering object from dbus: ${object_path}(${this._dbus_id})`);
            connection.unregister_object(this._dbus_id);
        }

        this._dbus_id = null;
    }

    vfunc_handle_local_options(options) {
        if (options.contains('version')) {
            print(`${Interface.app_id} ${Interface.metadata.version}`);
            return 0;
        }

        if (options.contains('debug')) {
            Interface.force_debug = true;
        }

        return -1;
    }

    vfunc_shutdown() {
        Logger.debug('vfunc_shutdown');
        
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
        Logger.debug('vfunc_startup');
        super.vfunc_startup();

        // Keep us open and running... we are a daemon
        this.hold();
    }

    _create_timer() {
        let interval,
            rotation = Interface.settings.rotation,
            [success, iterator] = Interface.rotation.get_iter_first();

        while (success) {
            if (Interface.rotation.get_value(iterator, 0) === rotation) {
                interval = (rotation === 'interval')? Interface.settings.interval : Interface.rotation.get_value(iterator, 3);
                rotation = Interface.rotation.get_value(iterator, 1);
                break;
            }
            
            success = Interface.rotation.iter_next(iterator);
        }

        if (rotation === 'interval') {
            this._timer = new Timer.Interval(interval, this.next.bind(this));
            if (Interface.settings.rotation === 'interval') {
                this._interval_changed_id = Interface.settings.connect('changed::interval', () => {
                    this._timer.destroy();
                    this._timer = new Timer.Interval(Interface.settings.interval, this.next.bind(this));
                });
            }
        } else if (Interface.settings.rotation === 'hourly') {
            this._timer = new Timer.Hourly(this.next.bind(this));
        } else if (Interface.settings.rotation === 'daily') {
            this._timer = new Timer.Daily(this.next.bind(this));
        }
    }

    _destroy_timer() {
        if (this._timer) {
            if (this._interval_changed_id) {
                Interface.settings.disconnect(this._interval_changed_id);
                this._interval_changed_id = null;
            }

            this._timer.destroy();
            this._timer = null;
        }
    }

    _dbus_call_load(invocation, profile) {
        invocation.return_value(new GLib.Variant('(b)', [this.loadprofile(profile)]));
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

    _dbus_call_stop(invocation, quit) {
        invocation.return_value(new GLib.Variant('(b)', [this.stop(), ]));

        if (quit) {
            this.quit();
        }
    }

    _handle_dbus_get(connection, sender, object_path, interface_name, property_name) {
        Logger.debug(`DBUS::getProperty(${property_name})`);
        switch (property_name.toLowerCase()) {
            case 'history':
                return new GLib.Variant('as', []);

            case 'queue':
                return new GLib.Variant('as', []);

            case 'preview':
                return new GLib.Variant('s', String(this.preview));

            case 'running':
                return new GLib.Variant('b', Boolean(this.running));
        }

        Logger.debug(`unknown property ${interface_name}.${property_name}`)
        return null;
    }

    _set_wallpaper(uri) {
        Logger.debug(`setting wallpaper to ${uri}`);
        this._background.set_string('picture-uri', uri);
        if (this._background_schema.has_key('picture-uri-dark')) {
            this._background.set_string('picture-uri-dark', uri);
        }
        this.emit_signal('Changed', new GLib.Variant('(s)', [uri]));
    }
}
);

(new Server()).run([imports.system.programInvocationName].concat(ARGV));
