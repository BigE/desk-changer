/**
 * Copyright (c) 2014-2018 Eric Gach <eric.gach@gmail.com>
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
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Signals = imports.signals;

const debug = Me.imports.utils.debug;
const profile = Me.imports.profile;
const timer = Me.imports.timer;


var DeskChangerDaemonDBusName = 'org.gnome.Shell.Extensions.DeskChanger.Daemon';
var DeskChangerDaemonDBusPath = '/org/gnome/Shell/Extensions/DeskChanger/Daemon';

var DeskChangerDaemonDBusInterface = '<node>\
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
        <method name="Start">\
            <arg direction="out" name="started" type="b" />\
        </method>\
        <method name="Stop">\
            <arg direction="out" name="stopped" type="b" />\
        </method>\
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
        <property type="b" name="running" access="read" />\
        <property type="as" name="queue" access="read" />\
    </interface>\
</node>';

var DeskChangerDaemonDBusInterfaceObject = Gio.DBusNodeInfo.new_for_xml(DeskChangerDaemonDBusInterface);

const DeskChangerDaemonDBusServer = new Lang.Class({
    Name: 'DeskChangerDaemonDBusServer',
    Abstract: true,

    _init: function () {
        this._dbus_id = null;
        this._dbus_connection = null;
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
                invocation.return_value(new GLib.Variant('(b)', [true,]));
                break;

            case 'stop':
                this.stop();
                invocation.return_value(new GLib.Variant('(b)', [true,]));
                break;

            default:
                invocation.return_dbus_error('org.freedesktop.DBus.Error.UnknownMethod',
                                             'Method ' + method_name + ' in ' + interface_name + ' does not exist');
                break;
        }
    },

    _dbus_handle_get: function (connection, sender, object_path, interface_name, property_name, parameters, invocation) {
        invocation.return_dbus_error('org.freedesktop.DBus.Error.InvalidArgs',
            'Property ' + property_name + ' in ' + interface_name + ' does not exist');
    },

    _dbus_handle_set: function (connection, sender, object_path, interface_name, property_name, parameters, invocation) {
        invocation.return_dbus_error('org.freedesktop.DBus.Error.InvalidArgs',
            'Property ' + property_name + ' in ' + interface_name + ' does not exist');
    },

    _emit_changed: function (uri) {
        if (this._dbus_connection) {
            let params = new GLib.VariantBuilder(new GLib.VariantType('r'));
            params.add_value(GLib.Variant.new_string(uri));
            debug('dbus::changed ' + uri);
            this._dbus_connection.emit_signal(null, DeskChangerDaemonDBusPath, DeskChangerDaemonDBusName, 'changed', params.end());
        }
    },

    _emit_preview: function (uri) {
        if (this._dbus_connection) {
            let params = new GLib.VariantBuilder(new GLib.VariantType('r'));
            params.add_value(GLib.Variant.new_string(uri));
            debug('dbus::preview ' + uri);
            this._dbus_connection.emit_signal(null, DeskChangerDaemonDBusPath, DeskChangerDaemonDBusName, 'preview', params.end());
        }
    },

    _on_bus_acquired: function (connection) {
        if (this._dbus_id !== null) return;

        try {
            this._dbus_id = connection.register_object(
                DeskChangerDaemonDBusPath,
                DeskChangerDaemonDBusInterfaceObject.interfaces[0],
                Lang.bind(this, this._dbus_handle_call),
                Lang.bind(this, this._dbus_handle_get),
                Lang.bind(this, this._dbus_handle_set),
            );
            this._dbus_connection = connection;
        } catch (e) {
            debug(e);
        } finally {
            if (this._dbus_id === null || this._dbus_id === 0) {
                debug('failed to register dbus object');
                this._dbus_id = null;
                this._dbus_connection = null;
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
        this.lockscreen_profile = new profile.DeskChangerProfileLockscreen(this._settings);

        this._desktop_profile_id = this.desktop_profile.connect('loaded', Lang.bind(this, function (obj) {
            if (this.running && this._settings.auto_rotate) {
                let wallpaper = this.desktop_profile.next(false);
                if (this._settings.update_lockscreen && !this.lockscreen_profile.loaded) {
                    this.lockscreen_profile._set_wallpaper(wallpaper);
                }
            }
        }));

        this._lockscreen_profile_id = this.lockscreen_profile.connect('loaded', Lang.bind(this, function (obj) {
            if (this.running && this._settings.auto_rotate) {
                this.lockscreen_profile.next(false);
            }
        }));

        this._changed_id = this.desktop_profile.connect('changed', Lang.bind(this, function (obj, uri) {
            this._emit_changed(uri);
            this.emit('changed', uri);
        }));

        this._preview_id = this.desktop_profile.connect('preview', Lang.bind(this, function (obj, uri) {
            this._emit_preview(uri);
            this.emit('preview', uri);
        }));
    },

    destroy: function () {
        if (this._desktop_profile_id) {
            this.desktop_profile.disconnect(this._desktop_profile_id);
        }

        if (this._lockscreen_profile_id) {
            this.lockscreen_profile.disconnect(this._lockscreen_profile_id);
        }

        if (this._changed_id) {
            this.desktop_profile.disconnect(this._changed_id);
        }

        if (this._preview_id) {
            this.desktop_profile.disconnect(this._preview_id);
        }

        this.parent();
    },

    next: function (_current = true) {
        let wallpaper;
        wallpaper = this.desktop_profile.next(_current);

        if (this._settings.update_lockscreen) {
            if (this.lockscreen_profile.loaded) {
                // if the lockscreen profile isn't the same, trigger the rotation
                this.lockscreen_profile.next(_current);
            } else {
                // if the lockscreen profile is inherited from the desktop, set the wallpaper
                this.lockscreen_profile._set_wallpaper(wallpaper);
            }
        }

        return wallpaper;
    },

    prev: function () {
        let wallpaper;
        wallpaper = this.desktop_profile.prev();

        if  (this._settings.update_lockscreen) {
            if (this.lockscreen_profile.loaded) {
                this.lockscreen_profile.next();
            } else {
                this.lockscreen_profile._set_wallpaper(wallpaper);
            }
        }

        return wallpaper;
    },

    start: function () {
        this.desktop_profile.load();

        if (this._settings.update_lockscreen && this._settings.lockscreen_profile) {
            this.lockscreen_profile.load();
        }

        this.parent();
        this._init_rotation();
        this.emit('running', true);

        if (this._settings.auto_rotate) {
            this.next(false);
        }
    },

    stop: function () {
        this.desktop_profile.unload();
        if (this.lockscreen_profile.loaded) {
            this.lockscreen_profile.unload();
        }

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

    _dbus_handle_get: function (connection, sender, object_path, interface_name, property_name, parameters, invocation) {
        switch (property_name) {
            case 'history':
                return new GLib.Variant('as', this.desktop_profile._history.queue);
            case 'queue':
                return new GLib.Variant('as', this.desktop_profile._queue.queue);
            case 'running':
                return new GLib.Variant('b', this.running);
        }

        this.parent(connection, sender, object_path, interface_name, property_name, parameters, invocation);
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
