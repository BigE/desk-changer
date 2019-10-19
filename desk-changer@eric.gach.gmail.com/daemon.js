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
const error = Me.imports.utils.error;
const debug = Me.imports.utils.debug;
const profile = Me.imports.profile;
const timer = Me.imports.timer;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

var DaemonDBusName = 'org.gnome.Shell.Extensions.DeskChanger.Daemon';
var DaemonDBusPath = '/org/gnome/Shell/Extensions/DeskChanger/Daemon';
var DaemonDBusInterface = '<node>\
    <interface name="%s">\
        <method name="LoadProfile">\
            <arg direction="in" name="profile" type="s" />\
            <arg direction="out" name="success" type="b" />\
        </method>\
        <method name="Next">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Prev">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Start">\
            <arg direction="out" name="success" type="b" />\
        </method>\
        <method name="Stop">\
            <arg direction="out" name="success" type="b" />\
        </method>\
        <property name="history" type="as" access="read" />\
        <signal name="changed">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
    </interface>\
</node>'.format(DaemonDBusName);

let DaemonDBusInterfaceObject = Gio.DBusNodeInfo.new_for_xml(DaemonDBusInterface).interfaces[0];

let DaemonDBusServer = GObject.registerClass({
    Properties: {
        'running': GObject.ParamSpec.boolean('running', 'Running', 'Boolean value if the daemon is running',
            GObject.ParamFlags.CONSTRUCT | GObject.ParamFlags.READABLE, false)
    }
}, class DeskChangerDaemonDBusServer extends GObject.Object {
    _init(params={}) {
        super._init(params);
        this._dbus = null;
        this._dbus_id = null;
        this._dbus_connection = null;
        this._running = false;

        try {
            this._dbus = Gio.bus_own_name(Gio.BusType.SESSION, DaemonDBusName, Gio.BusNameOwnerFlags.NONE, this._on_bus_acquired.bind(this), null, function () {
                debug('unable to acquire bus name %s'.format(DaemonDBusName));
            });
        } catch (e) {
            error(e, 'unable to own dbus name %s'.format(DaemonDBusName));
        }
    }

    destroy() {
        this.stop();

        if (this._dbus)
            Gio.bus_unown_name(this._dbus);
    }

    start() {
        this._running = true;
        debug('daemon started');
    }

    stop() {
        this._running = false;
        debug('daemon stopped');
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
                debug('unknown dbus method %s'.format(method_name));
                break;
        }
    }

    _dbus_handle_get() {
    }

    _dbus_handle_set() {
    }

    _on_bus_acquired(connection) {
        // cannot haz two
        if (this._dbus_id !== null) return;

        try {
            this._dbus_id = connection.register_object(
                DaemonDBusPath,
                DaemonDBusInterfaceObject,
                this._dbus_handle_call.bind(this),
                this._dbus_handle_get.bind(this),
                this._dbus_handle_set.bind(this),
            );
            this._dbus_connection = connection;
            debug('acquired dbus connection for %s'.format(DaemonDBusPath));
        } catch (e) {
            error(e, 'failed to register dbus object: %s'.format(e));
        } finally {
            if (this._dbus_id === null || this._dbus_id === 0) {
                debug('failed to register dbus object');
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
        this.desktop_profile = new profile.DeskChangerDesktopProfile(this._settings);
    }

    next() {
        let wallpaper = this.desktop_profile.next();
        this.emit('changed', wallpaper);
        return wallpaper;
    }

    prev() {
        let wallpaper = this.desktop_profile.prev();
        this.emit('changed', wallpaper);
        return wallpaper;
    }

    start() {
        this.desktop_profile.load();
        this._timer = new timer.DeskChangerTimer(this._settings.get_int('interval'), this.next.bind(this));
        super.start();

        // If we're configured to automatically rotate, do it!
        if (this._settings.get_boolean('auto-rotate')) {
            this.desktop_profile.next(false);
        }
    }

    stop() {
        this._timer.destroy();
        this.desktop_profile.unload();
        super.stop();
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


