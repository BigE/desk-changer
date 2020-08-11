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
const Utils = imports.common.utils;
const _ = deskchanger._;

var Server = GObject.registerClass({
    GTypeName: 'DeskChangerDaemon',
    Properties: {
        'next': GObject.ParamSpec.string(
            'next',
            'Next',
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
    }
},
class Server extends Gio.Application {
    _init() {
        this._running = false;
        this._dbus_id = null;

        super._init({
            application_id: Interface.APP_ID,
            flags: Gio.ApplicationFlags.IS_SERVICE |
                   Gio.ApplicationFlags.HANDLES_OPEN |
                   Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
        });

        this.add_main_option('debug', 'd'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE, _('Enable debugging'), null);
        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE, _('Show release version'), null);
    }

    get running() {
        return this._running;
    }

    start() {
        if (this._running) {
            deskchanger.debug('daemon is already started');
            return false;
        }

        this._running = true;
        return true;
    }

    stop() {
        if (!this._running) {
            deskchanger.debug('cannot stop, daemon isn\'t running');
            return false;
        }

        this._running = false;
        return true;
    }

    vfunc_dbus_register(connection, object_path) {
        if (super.vfunc_dbus_register(connection, object_path)) {
            deskchanger.debug(`attempting to register object on dbus: ${object_path}`);

            try {
                this._dbus_id = connection.register_object(
                    object_path,
                    deskchanger.dbusinfo.lookup_interface(Interface.APP_ID),
                    this._handle_dbus_call.bind(this),
                    this._handle_dbus_get.bind(this),
                    this._handle_dbus_set.bind(this)
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
        super.vfunc_shutdown();
    }

    vfunc_startup() {
        deskchanger.debug('vfunc_startup');
        super.vfunc_startup();

        // Keep us open and running... we are a daemon
        this.hold();
    }

    _handle_dbus_call(connection, sender, object_path, interface_name, method_name, parameters, invocation) {
        deskchanger.debug(`[DBUS:call] ${interface_name}.${method_name}`);

        if (['loadprofile', 'next', 'prev', 'stop'].includes(method_name.toLowerCase()) && !this.running) {
            invocation.return_dbus_error(`${interface_name}.${method_name}`, `The daemon must be started first`);
            return;
        }

        switch (method_name.toLowerCase()) {
            case 'loadprofile':
                invocation.return_value(new GLib.Variant('(b)', [false, ]));
                return;

            case 'next':
                var wallpaper = '';
                invocation.return_value(new GLib.Variant('(s)', [wallpaper, ]))
                return;

            case 'prev':
                var wallpaper = '';
                invocation.return_value(new GLib.Variant('(s)', [wallpaper, ]))
                return;

            case 'quit':
                invocation.return_value(null);
                this.quit();
                return;

            case 'start':
                invocation.return_value(new GLib.Variant('(b)', [false, ]));
                return;

            case 'stop':
                invocation.return_value(new GLib.Variant('(b)', [false, ]));
                return;
        }

        deskchanger.error(`[DBUS] invalid method ${method_name}`);
        invocation.return_dbus_error(
            `${interface_name}.${method_name}`,
            `Method ${method_name} does not exist in ${interface_name}`
        );
    }

    _handle_dbus_get(connection, sender, object_path, interface_name, property_name) {
        deskchanger.debug(`DBUS::getProperty(${property_name})`);
        switch (property_name) {
            case 'history':
                return new GLib.Variant('as', []);

            case 'queue':
                return new GLib.Variant('as', []);

            case 'running':
                return new GLib.Variant('b', this.running);
        }

        deskchanger.error(`unknown property ${interface_name}.${property_name}`)
        return null;
    }

    _handle_dbus_set() {
    }
}
);

(new Server()).run([imports.system.programInvocationName].concat(ARGV));
