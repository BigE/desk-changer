/**
 * Copyright (c) 2018 Eric Gach <eric.gach@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Profile = Me.imports.daemon.profile;
const Timer = Me.imports.daemon.timer;
const Interface = Me.imports.daemon.interface;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

let DaemonDBusInterfaceObject = Gio.DBusNodeInfo.new_for_xml(Interface.DBusInterface).interfaces[0];

let DaemonDBusServer = GObject.registerClass({
    Properties: {
        'running': GObject.ParamSpec.boolean('running', 'Running', 'Boolean value if the daemon is running',
            GObject.ParamFlags.CONSTRUCT | GObject.ParamFlags.READABLE, false)
    },
    Signals: {
        'toggled': { param_types: [GObject.TYPE_BOOLEAN] }
    },
}, class DeskChangerDaemonDBusServer extends GObject.Object {
    _init(params={}) {
        super._init(params);
        this._dbus = null;
        this._dbus_id = null;
        this._dbus_connection = null;
        this._running = false;

        try {
            this._dbus = Gio.bus_own_name(Gio.BusType.SESSION, Interface.DBusName, Gio.BusNameOwnerFlags.NONE, this._on_bus_acquired.bind(this), null, function () {
                Utils.debug(`unable to acquire bus name ${Interface.DBusName}`);
            });
        } catch (e) {
            Utils.error(e, `unable to own dbus name ${Interface.DBusName}`);
            this._dbus = false;
        }
    }

    destroy() {
        this.stop();

        if (this._dbus)
            Gio.bus_unown_name(this._dbus);
    }

    start() {
        if (!this._dbus) {
            Utils.debug('Unable to start daemon, dbus not connected');
        }

        this._running = true;
        Utils.debug('daemon started');
        this.emit('toggled', this._running);
    }

    stop() {
        this._running = false;
        Utils.debug('daemon stopped');
        this.emit('toggled', this._running);
    }

    get running() {
        return this._running;
    }

    _dbus_handle_call(connection, sender, object_path, interface_name, method_name, parameters, invocation) {
        switch (method_name.toLowerCase()) {
            case 'start':
                this.start();
                invocation.return_value(new GLib.Variant('(b)', [true,]));
                break;

            case 'stop':
                this.stop();
                invocation.return_value(new GLib.Variant('(b)', [true,]));
                break;

            default:
                invocation.return_dbus_error('org.freedesktop.DBus.Error.UnknownMethod',
                                             'Method ' + method_name + ' in ' + interface_name + ' does not exist');
                Utils.debug(`unknown dbus method ${method_name}`);
                break;
        }
    }

    _dbus_handle_get(connection, sender, object_path, interface_name, property_name) {
        Utils.debug(`dbus::getProperty(${property_name})`);
        switch (property_name) {
            case 'history':
                return new GLib.Variant('as', this.desktop_profile.history.all());

            case 'running':
                return new GLib.Variant('b', this._running);

            default:
                // should error here?
                Utils.error(`unknown dbus property ${property_name}`);
                return null;
        }
    }

    _dbus_handle_set() {
    }

    _on_bus_acquired(connection) {
        // cannot haz two
        if (this._dbus_id !== null) return;

        try {
            this._dbus_id = connection.register_object(
                Interface.DBusPath,
                DaemonDBusInterfaceObject,
                this._dbus_handle_call.bind(this),
                this._dbus_handle_get.bind(this),
                this._dbus_handle_set.bind(this),
            );
            this._dbus_connection = connection;
            Utils.debug(`acquired dbus connection for ${DaemonDBusPath}`);
        } catch (e) {
            error(e, `failed to register dbus object: ${e}`);
        } finally {
            if (this._dbus_id === null || this._dbus_id === 0) {
                Utils.debug('failed to register dbus object');
                this._dbus_id = null;
                this._dbus_connection = null;
            }
        }
    }
});

var Daemon = GObject.registerClass({
    Signals: {
        'changed': { param_types: [GObject.TYPE_STRING] },
    },
},
class DeskChangerDaemon extends DaemonDBusServer {
    _init(settings, params = {}) {
        super._init(params);
        this._settings = settings;
        this.desktop_profile = new Profile.DesktopProfile(settings);
        this.lockscreen_profile = new Profile.LockScreenProfile(settings);

        this._loaded_id = this.desktop_profile.connect('loaded', () => {
            let wallpaper = this.desktop_profile.next(false);
            if (settings.update_lockscreen && this.lockscreen_profile.inherit) {
                this.lockscreen_profile.next(false, wallpaper);
            }
        });
        this._lockscreen_loaded_id = this.lockscreen_profile.connect('loaded', () => {
            this.lockscreen_profile.next(false);
        });
    }

    destroy() {
        if (this._timer) {
            this._timer.destroy();
        }

        this.desktop_profile.disconnect(this._loaded_id);
        this.lockscreen_profile.disconnect(this._lockscreen_loaded_id);
        super.destroy();
    }

    next() {
        let wallpaper = this.desktop_profile.next();
        if (this._settings.update_lockscreen) {
            (this.lockscreen_profile.inherit) ? this.lockscreen_profile.next(true, wallpaper) : this.lockscreen_profile.next();
        }
        this.emit('changed', wallpaper);
        return wallpaper;
    }

    prev() {
        let wallpaper = this.desktop_profile.prev();
        if (this._settings.update_lockscreen) {
            (this.lockscreen_profile.inherit) ? this.lockscreen_profile.prev(true, wallpaper) : this.lockscreen_profile.prev();
        }
        this.emit('changed', wallpaper);
        return wallpaper;
    }

    start() {
        this.desktop_profile.load();
        this.lockscreen_profile.load();
        super.start();
        this._check_timer(this._settings);

        this._settings.connect('changed::rotation', (settings, key) => {
            this._check_timer(settings);
        });
    }

    stop() {
        if (this._timer) {
            this._timer.destroy();
        }

        this.desktop_profile.unload();
        this.lockscreen_profile.unload();
        super.stop();
    }

    _check_timer(settings) {
        if (this._timer) {
            // no matter the change, destroy the current timer
            this._timer.destroy();
            this._timer = null;
        }
        
        if (settings.rotation == 'interval') {
            this._timer = new Timer.Interval(settings.get_int('interval'), this.next.bind(this));
        } else if (settings.rotation == 'hourly') {
            this._timer = new Timer.Hourly(this.next.bind(this));
        }
    }

    _dbus_handle_call(connection, sender, object_path, interface_name, method_name, parameters, invocation) {
        switch (method_name.toLowerCase()) {
            case 'loadprofile':
                break;

            case 'next':
                let uri = this.next();
                invocation.return_value(new GLib.Variant('(s)', [uri, ]));
                return;

            case 'prev':
                break;
        }

        super._dbus_handle_call(connection, sender, object_path, interface_name, method_name, parameters, invocation);
    }
});


