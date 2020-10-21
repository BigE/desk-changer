'use strict';

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Interface = Me.imports.daemon.interface;

function makeProxyWrapper() {
    let proxy = Gio.DBusProxy.makeProxyWrapper(deskchanger.dbusxml);
    return new proxy(
        Gio.DBus.session,
        Interface.APP_ID,
        Interface.APP_PATH
    );
}
