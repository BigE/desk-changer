#!/usr/bin/env gjs

'use strict';

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

// Find the root datadir of the extension
function get_datadir() {
    let m = /@(.+):\d+/.exec((new Error()).stack.split('\n')[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_parent().get_path();
}

imports.searchPath.unshift(get_datadir());
imports._deskchanger;

const Interface = imports.daemon.interface;
const Utils = imports.common.utils;

var Server = GObject.registerClass({
    GTypeName: 'DeskChangerDaemon',
    Properties: {
        'next': GObject.ParamSpec.string(
            'next',
            'Next',
            'The next wallpaper in queue',
            GObject.ParamFlags.READWRITE,
            null
        ),
    }
},
class Server extends Gio.Application {
    _init() {
        this._dbus_id = null;

        super._init({
            application_id: Interface.APP_ID,
            flags: Gio.ApplicationFlags.IS_SERVICE |
                   Gio.ApplicationFlags.HANDLES_OPEN |
                   Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
        });
    }

    vfunc_dbus_register(connection, object_path) {
        if (super.vfunc_dbus_register(connection, object_path)) {
            try {
                this._dbus_id = connection.register_object(
                    object_path,
                    deskchanger.dbusinfo.lookup_interface(Interface.APP_ID),
                    this._handle_dbus_call.bind(this),
                    this._handle_dbus_get.bind(this),
                    this._handle_dbus_set.bind(this)
                );

                deskchanger.debug(`registered object on dbus: ${object_path}(${this._dbus_id})`);
                return true;
            } catch (e) {
                deskchanger.error(e, `failed to register dbus: ${object_path}`);
            } finally {
                if (this._dbus_id !== null && this._dbus_id === 0) {
                    this._dbus_id = null;
                }
            }
        }

        return false;
    }

    vfunc_dbus_unregister(connection, object_path) {
        if (this._dbus_id) {
            deskchanger.debug(`unregistering object on dbus: ${object_path}(${this._dbus_id})`);
            connection.unregister_object(this._dbus_id);
        }

        this._dbus_id = null;
    }

    _handle_dbus_call() {
    }

    _handle_dbus_get() {
    }

    _handle_dbus_set() {
    }
}
);

(new Server()).run([imports.system.programInvocationName].concat(ARGV));
