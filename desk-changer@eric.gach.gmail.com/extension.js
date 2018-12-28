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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Config = imports.misc.config;
const Gettext = imports.gettext.domain('desk-changer');
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const _ = Gettext.gettext;

const Convenience = Me.imports.convenience;
const DeskChangerDaemon = Me.imports.daemon.DeskChangerDaemon;
const DeskChangerSettings = Me.imports.settings.DeskChangerSettings;
const DeskChangerVersion = Me.metadata.version;
const debug = Me.imports.utils.debug;
const Menu = Me.imports.menu;
const Ui = Me.imports.ui;

/**
 * This is the actual indicator that should be added to the main panel.
 */
class DeskChangerIndicator extends PanelMenu.Button {
    constructor(daemon) {
        super(0.0, 'DeskChanger');
        this.settings = new DeskChangerSettings();
        this.daemon = daemon;

        this._icon = new Ui.DeskChangerIcon(this.daemon, this.settings);
        this.actor.add_child(this._icon);
        this.menu.addMenuItem(new Menu.DeskChangerProfileDesktop(this.settings));
        if (this.settings.update_lockscreen) {
            this.menu.addMenuItem(new Menu.DeskChangerProfileLockscreen(this.settings));
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerSwitch(_('Change with Profile'), 'auto_rotate', this.settings));
        this.menu.addMenuItem(new Menu.DeskChangerSwitch(_('Notifications'), 'notifications', this.settings));
        this.menu.addMenuItem(new Menu.DeskChangerSwitch(_('Remember Profile State'), 'remember_profile_state', this.settings));

        if (Main.screenShield !== null) {
            this.menu.addMenuItem(new Menu.DeskChangerSwitch(_('Update Lock Screen'), 'update_lockscreen', this.settings));
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerPreviewMenuItem(this.daemon));
        this.menu.addMenuItem(new Menu.DeskChangerOpenCurrent());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerRotation(this.settings, true));
        this.menu.addMenuItem(new Menu.DeskChangerControls(this.daemon, this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new Menu.DeskChangerDaemonControls(this.daemon));
        // Simple settings for the extension
        let settings = new PopupMenu.PopupMenuItem(_('DeskChanger Settings'));
        settings.connect('activate', function () {
            Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
        });
        this.menu.addMenuItem(settings);
        this.settings.connect('changed::update-lockscreen', Lang.bind(this, function () {
            if (this.settings.update_lockscreen) {
                this.menu.addMenuItem(new Menu.DeskChangerProfileLockscreen(this.settings), 1);
            } else {
                this.menu.box.get_children().map(function (actor) {
                    return actor._delegate;
                }).filter(function (item) {
                    item instanceof Menu.DeskChangerProfileLockscreen && item.destroy();
                });
            }
        }));
    }

    destroy() {
        this._icon.destroy();
        super.destroy();
        this.settings.destroy();
    }
}

class DeskChangerSystemIndicator extends PanelMenu.SystemIndicator {
    constructor(daemon, menu) {
        super();
        this.daemon = daemon;

        this.settings = new DeskChangerSettings();
        this._menu = new PopupMenu.PopupSubMenuMenuItem('DeskChanger', true);
        this._menu.icon.set_gicon(Gio.icon_new_for_string(Me.path + '/icons/wallpaper-icon.png'));
        this._menu.menu.addMenuItem(new Menu.DeskChangerProfileDesktop(this.settings, false));
        this._menu.menu.addMenuItem(new Menu.DeskChangerPreviewMenuItem(this.daemon));
        this._menu.menu.addMenuItem(new Menu.DeskChangerOpenCurrent());
        this._menu.menu.addMenuItem(new Menu.DeskChangerRotation(this.settings, false));
        this._menu.menu.addMenuItem(new Menu.DeskChangerControls(this.daemon, this.settings));
        this._menu.menu.addMenuItem(new Menu.DeskChangerDaemonControls(this.daemon));
        // Simple settings for the extension
        let settings = new PopupMenu.PopupMenuItem(_('DeskChanger Settings'));
        settings.connect('activate', function () {
            Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
        });
        this._menu.menu.addMenuItem(settings);
        let position = (parseInt(Config.PACKAGE_VERSION.split(".")[1]) < 18) ? this._menu.menu.numMenuItems - 2 : this._menu.menu.numMenuItems - 1;
        menu.addMenuItem(this._menu, position);
        this._indicator = null;
        this.settings.connect('changed::icon-preview', Lang.bind(this, this._update_indicator));
        this._update_indicator();
    }

    destroy() {
        if (this._indicator) {
            this._indicator.destroy();
        }

        this._menu.destroy();
        this.settings.destroy();
    }

    _update_indicator() {
        if (this._indicator !== null) {
            this.indicators.remove_actor(this._indicator);
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this.settings.icon_preview) {
            this._indicator = new Ui.DeskChangerIcon(this.daemon, this.settings);
            this.indicators.add_actor(this._indicator);
            this._indicator.connect('notify::visible', this._syncIndicatorsVisible.bind(this));
            this._syncIndicatorsVisible();
        }
    }
}

let daemon, indicator, settings, shellSettings;
let changed_id, current_profile_id, notifications_id, random_id, rotation_id;

function disable() {
    debug('disabling extension');

    if (typeof indicator.destroy === "function") {
        indicator.destroy();
    }

    if (current_profile_id) {
        settings.disconnect(current_profile_id);
    }

    if (notifications_id) {
        settings.disconnect(notifications_id);
    }

    if (changed_id) {
        daemon.disconnect(changed_id);
    }

    if (random_id) {
        settings.disconnect(random_id);
    }

    if (rotation_id) {
        settings.disconnect(rotation_id);
    }

    changed_id = null;
    current_profile_id = null;
    notifications_id = null;
    random_id = null;
    rotation_id = null;
    indicator = null;
}

function enable() {
    debug('enabling extension');

    current_profile_id = settings.connect('changed::current-profile', function () {
        if (settings.notifications)
            Main.notify('Desk Changer', _('Profile changed to %s'.format(settings.current_profile)));
    });

    notifications_id = settings.connect('changed::notifications', function () {
        Main.notify('Desk Changer', ((settings.notifications) ? _('Notifications are now enabled') : _('Notifications are now disabled')));
    });

    changed_id = daemon.connect('changed', function (obj, wallpaper) {
        if (settings.notifications)
            Main.notify('Desk Changer', _('Wallpaper Changed: %s'.format(wallpaper)));
    });

    random_id = settings.connect('changed::random', function () {
        if (settings.notifications) {
            let message;

            if (settings.random) {
                message = _('Wallpapers will be shown in a random order');
            } else {
                message = _('Wallpapers will be shown in the order the were loaded');
            }

            Main.notify('Desk Changer', message);
        }
    });

    rotation_id = settings.connect('changed::rotation', function () {
        if (settings.notifications) {
            let message;
            switch (settings.rotation) {
                case 'interval':
                    message = _('Rotation will occur every %d seconds'.format(settings.interval));
                    break;
                case 'hourly':
                    message = _('Rotation will occur at the beginning of every hour');
                    break;
                default:
                    message = _('Rotation has been disabled');
                    break;
            }

            Main.notify('Desk Changer', message);
        }
    });

    if (!daemon.running && settings.auto_start) {
        // run if auto start is enabled and its not already running
        daemon.start();
    }

    if (settings.integrate_system_menu) {
        indicator = new DeskChangerSystemIndicator(daemon, Main.panel.statusArea.aggregateMenu.menu);
        Main.panel.statusArea.aggregateMenu._indicators.insert_child_at_index(indicator.indicators, 0);
    } else {
        indicator = new DeskChangerIndicator(daemon);
        Main.panel.addToStatusArea('deskchanger', indicator);
    }
}

function init() {
    Convenience.initTranslations();
    debug('initalizing extension version: %s'.format(DeskChangerVersion));
    settings = new DeskChangerSettings();
    shellSettings = Convenience.getSettings('org.gnome.shell');
    daemon = new DeskChangerDaemon(settings);

    Gio.DBus.session.connect('closed', function () {
        if (daemon.running) {
            daemon.stop();
        }
    });

    settings.connect('changed::integrate-system-menu', function () {
        if (indicator !== null) {
            disable();
            enable();
        }
    });
}
