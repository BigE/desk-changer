/**
 * Copyright (c) 2014-2017 Eric Gach <eric.gach@gmail.com>
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
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const Signals = imports.signals;

const debug = Me.imports.utils.debug;
const profile = Me.imports.profile;
const timer = Me.imports.timer;


var DeskChangerDaemonDBusName = 'org.gnome.Shell.Extensions.DeskChanger.Daemon';
var DeskChangerDaemonDBusPath = '/org/gnome/Shell/Extensions/DeskChanger/Daemon';

var DeskChangerDaemonDBusInterface = Gio.DBusNodeInfo.new_for_xml('<node>\
    <interface name="org.gnome.Shell.Extensions.DeskChanger.Daemon">\
        <method name="LoadProfile">\
            <arg direction="in" name="profile" type="s" />\
        </method>\
        <method name="Next">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Prev">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Start"></method>\
        <method name="Stop"></method>\
        <signal name="changed">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
        <signal name="error">\
            <arg direction="out" name="message" type="s" />\
        </signal>\
        <signal name="preview">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
        <property type="as" name="history" access="read" />\
        <property type="b" name="lockscreen" access="write" />\
        <property type="as" name="queue" access="read" />\
    </interface>\
</node>');

const DeskChangerDaemonDBusServer = new Lang.Class({
    Name: 'DeskChangerDaemonDBusServer',
    Abstract: true,

    _init: function () {
        this._dbus_id = null;
        this._running = false;

        try {
            this._dbus = Gio.bus_own_name(Gio.BusType.SESSION, DeskChangerDaemonDBusName, Gio.BusNameOwnerFlags.NONE, Lang.bind(this, this._on_bus_acquired), null, function () {
                debug('unable to acquire bus name %s'.format(DeskChangerDaemonDBusName));
            });
        } catch (e) {
            debug('unable to own dbus name (%s)'.format(e));
        }
    },

    destroy: function () {
        this.stop();
        Gio.bus_unown_name(this._dbus);
    },

    start: function () {
        this._running = true;
    },

    stop: function () {
        this._running = false;
    },

    get running() {
        return this._running;
    },

    _dbus_handle_call: function (connection, sender, object_path, interface_name, method_name, parameters, invocation) {
        switch (method_name.toLowerCase()) {
            case 'start':
                this.start();
                break;

            case 'stop':
                this.stop();
                break;

            default:
                invocation.return_dbus_error('org.freedesktop.DBus.Error.UnknownMethod',
                                             'Method ' + method_name + ' in ' + interface_name + ' does not exist');
                break;
        }
    },

    _dbus_handle_get: function (connection, sender, object_path, interface_name, method_name, parameters, invocation) {
    },

    _dbus_handle_set: function (connection, sender, object_path, interface_name, method_name, parameters, invocation) {
    },

    _on_bus_acquired: function (connection) {
        debug(this._dbus_id);
        if (this._dbus_id !== null) return;

        try {
            this._dbus_id = connection.register_object(
                DeskChangerDaemonDBusPath,
                DeskChangerDaemonDBusInterface.interfaces[0],
                Lang.bind(this, this._dbus_handle_call),
                Lang.bind(this, this._dbus_handle_get),
                Lang.bind(this, this._dbus_handle_set),
            );
        } catch (e) {
            debug(e);
        } finally {
            if (this._dbus_id === null || this._dbus_id === 0) {
                debug('failed to register dbus object');
                this._dbus_id = null;
            }
        }
    },
});

var DeskChangerDaemon = new Lang.Class({
    Name: 'DeskChangerDaemon',
    Extends: DeskChangerDaemonDBusServer,

    _init: function (settings) {
        this._settings = settings;
        this.parent();
        this.desktop_profile = new profile.DeskChangerProfileDesktop(this._settings);
        this.lockscreen_profile = null;
    },

    destroy: function () {
        this.parent();
    },

    next: function () {
        let wallpaper;
        wallpaper = this.desktop_profile.next();
        return wallpaper;
    },

    prev: function () {
        let wallpaper;
        wallpaper = this.desktop_profile.prev();
        return wallpaper;
    },

    start: function () {
        this.desktop_profile.load();
        this.parent();
        this._init_rotation();
        this.emit('running', true);
    },

    stop: function () {
        this.desktop_profile.unload();

        if (this.timer) {
            this.timer.destroy();
            this.timer = null;
        }

        this.parent();
        this.emit('running', false);
    },

    _dbus_handle_call: function (connection, sender, object_path, interface_name, method_name, parameters, invocation) {
        switch (method_name.toLowerCase()) {
            case 'next':
                invocation.return_value(new GLib.Variant('(s)', [this.next(),]));
                break;
            case 'prev':
                try {
                    invocation.return_value(new GLib.Variant('(s)', [this.prev(),]));
                } catch (e) {
                    if (e instanceof profile.DeskChangerProfileError) {
                        invocation.return_dbus_error(DeskChangerDaemonDBusName.concat('.Error.HistoryEmpty'), e.message);
                    } else {
                        invocation.return_dbus_error(DeskChangerDaemonDBusName.concat('.Error'), e);
                    }
                }
                break;
            default:
                this.parent(connection, sender, object_path, interface_name, method_name, parameters, invocation);
                break;
        }
    },

    _init_rotation: function() {
        switch (this._settings.rotation) {
            case 'interval':
                this.timer = new timer.DeskChangerTimerInterval(this._settings, Lang.bind(this, this.next));
                break;

            case 'hourly':
                this.timer = new timer.DeskChangerTimerHourly(Lang.bind(this, this.next));
                break;
        }
    },
});

Signals.addSignalMethods(DeskChangerDaemon.prototype);
