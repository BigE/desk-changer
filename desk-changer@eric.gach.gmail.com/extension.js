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

const Config = imports.misc.config;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const DeskChangerDaemon = Me.imports.daemon.DeskChangerDaemon;
const DeskChangerSettings = Me.imports.settings.DeskChangerSettings;
const DeskChangerVersion = Me.metadata.version;
const debug = Me.imports.utils.debug;
const Menu = Me.imports.menu;
const Ui = Me.imports.ui;

/**
 * This is the actual indicator that should be added to the main panel.
 *
 * @type {Lang.Class}
 */
const DeskChangerIndicator = new Lang.Class({
    Name: 'DeskChangerIndicator',
    Extends: PanelMenu.Button,

    _init: function () {
        this.settings = new DeskChangerSettings();
        this.parent(0.0, 'DeskChanger');
        this.daemon = new DeskChangerDaemon(this.settings);

        this.actor.add_child(new Ui.DeskChangerIcon(this.daemon, this.settings));
        this.menu.addMenuItem(new Menu.DeskChangerProfile(this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerSwitch('Change with Profile', 'auto_rotate', this.settings));
        this.menu.addMenuItem(new Menu.DeskChangerSwitch('Notifications', 'notifications', this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerPreviewMenuItem(this.daemon));
        this.menu.addMenuItem(new Menu.DeskChangerOpenCurrent());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerControls(this.daemon.bus, this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerDaemonControls(this.daemon));
        // Simple settings for the extension
        let settings = new PopupMenu.PopupMenuItem('DeskChanger Settings');
        settings.connect('activate', function () {
            Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
        });
        this.menu.addMenuItem(settings);
    },

    destroy: function () {
        this.parent();
        this.settings.destroy();
        this.daemon.destroy();
    }
});

const DeskChangerSystemIndicator = new Lang.Class({
    Name: 'DeskChangerSystemIndicator',
    Extends: PanelMenu.SystemIndicator,

    _init: function (menu) {
        this.parent();
        this.daemon = new DeskChangerDaemon();

        this.settings = new DeskChangerSettings();
        this._menu = new PopupMenu.PopupSubMenuMenuItem('DeskChanger', true);
        this._menu.icon.set_gicon(Gio.icon_new_for_string(Me.path + '/icons/wallpaper-icon.png'));
        this._menu.menu.addMenuItem(new Menu.DeskChangerProfile(this.settings, false));
        this._menu.menu.addMenuItem(new Menu.DeskChangerPreviewMenuItem(this.daemon));
        this._menu.menu.addMenuItem(new Menu.DeskChangerOpenCurrent());
        this._menu.menu.addMenuItem(new Menu.DeskChangerControls(this.daemon.bus, this.settings));
        this._menu.menu.addMenuItem(new Menu.DeskChangerDaemonControls(this.daemon));
        // Simple settings for the extension
        let settings = new PopupMenu.PopupMenuItem('DeskChanger Settings');
        settings.connect('activate', function () {
            Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
        });
        this._menu.menu.addMenuItem(settings);
        let position = (parseInt(Config.PACKAGE_VERSION.split(".")[1]) < 18)? this._menu.menu.numMenuItems - 2 : this._menu.menu.numMenuItems - 1;
        menu.addMenuItem(this._menu, position);
        this._indicator = new Ui.DeskChangerIcon(this.daemon, this.settings);
        this.indicators.add_actor(this._indicator);
        this._indicator.connect('notify::visible', Lang.bind(this, this._syncIndicatorsVisible));
        this._syncIndicatorsVisible();
    },

    destroy: function () {
        this._menu.destroy();
        this._indicator.destroy();
        this.settings.destroy();
        this.daemon.destroy();
    }
});

let daemon, indicator, settings;
let changed_id, current_profile_id, error_id, notifications_id;

function disable() {
    debug('disabling extension');

    if (typeof indicator.destroy == "function") {
        indicator.destroy();
    }

    if (current_profile_id) {
        settings.disconnect(current_profile_id);
    }

    if (notifications_id) {
        settings.disconnect(notifications_id);
    }

    if (changed_id) {
        daemon.disconnectSignal(changed_id);
    }

    if (error_id) {
        daemon.disconnectSignal(error_id);
    }

    changed_id = null;
    current_profile_id = null;
    error_id = null;
    notifications_id = null;
    indicator = null;
}

function enable() {
    debug('enabling extension');

    if (settings.integrate_system_menu) {
        indicator = new DeskChangerSystemIndicator(Main.panel.statusArea.aggregateMenu.menu);
        Main.panel.statusArea.aggregateMenu._indicators.insert_child_at_index(indicator.indicators, 0);
    } else {
        indicator = new DeskChangerIndicator();
        Main.panel.addToStatusArea('deskchanger', indicator);
    }

    current_profile_id = settings.connect('changed::current-profile', function () {
        if (settings.notifications)
            Main.notify('Desk Changer', 'Profile changed to ' + settings.current_profile);
    });

    notifications_id = settings.connect('changed::notifications', function () {
        Main.notify('Desk Changer', 'Notifications are now ' + ((settings.notifications) ? 'enabled' : 'disabled'));
    });

    changed_id = daemon.connectSignal('changed', function (emitter, signalName, parameters) {
        if (settings.notifications)
            Main.notify('Desk Changer', 'Wallpaper Changed: ' + parameters[0]);
    });

    error_id = daemon.connectSignal('error', function (emitter, signalName, parameters) {
        Main.notifyError('Desk Changer', 'Daemon Error: ' + parameters[0]);
    });

    if (!daemon.is_running && settings.auto_start) {
        // run if auto start is enabled and its not already running
        daemon.toggle();
    }
}

function init() {
    debug('initalizing extension version: ' + DeskChangerVersion);
    settings = new DeskChangerSettings();
    daemon = new DeskChangerDaemon(settings);

    settings.connect('changed::integrate-system-menu', function () {
        if (indicator != null) {
            disable();
            enable();
        }
    });
}
