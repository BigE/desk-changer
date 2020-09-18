'use strict';

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Interface = Me.imports.daemon.interface;

function makeProxyWrapper() {
    return new Gio.DBusProxy({
        g_connection: Gio.DBus.session,
        g_interface_name: deskchanger.dbusinfo.interfaces[0].name,
        g_interface_info: deskchanger.dbusinfo.interfaces[0],
        g_name: Interface.APP_ID,
        g_object_path: Interface.APP_PATH,
        g_flags: Gio.DBusProxyFlags.NONE,
    });
}
