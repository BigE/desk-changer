'use strict';

import Gio from 'gi://Gio';

import Interface from '../daemon/interface.js';

export function makeProxyWrapper() {
    let proxy = Gio.DBusProxy.makeProxyWrapper(Interface.dbusxml);
    return new proxy(
        Gio.DBus.session,
        Interface.app_id,
        Interface.app_path
    );
}
