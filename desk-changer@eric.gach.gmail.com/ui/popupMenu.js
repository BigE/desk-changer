'use strict';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Shell from 'gi://Shell';
import St from 'gi://St';

import Interface from '../daemon/interface.js';
import * as DeskChangerControl from './control.js';
import * as Logger from '../common/logging.js';

export const ControlsMenuItem = GObject.registerClass(
class DeskChangerPopupMenuControlsMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(daemon) {
        super._init({'can_focus': false, 'reactive': false});
        this._bindings = [];

        this._addKeyBinding('next-wallpaper', () => {
            daemon.NextSync();
        });
        this._addKeyBinding('prev-wallpaper', () => {
            daemon.PrevSync();
        });

        this._next = new DeskChangerControl.ButtonControl('media-skip-forward', () => {
            daemon.NextSync();
        });
        this._prev = new DeskChangerControl.ButtonControl('media-skip-backward', () => {
            if (!daemon.PrevSync()) {
                Main.notifyError('DeskChanger', _('No more wallpapers available in history'));
            }
        });
        this._random = new DeskChangerControl.StateButtonControl([
            {
                icon: 'media-playlist-shuffle',
                name: 'random',
            },
            {
                icon: 'media-playlist-repeat',
                name: 'ordered',
            },
        ], (state) => {
            Logger.debug(`setting order to ${state}`);
            Interface.settings.random = (state === 'random');
        });
        this._random.set_state((Interface.settings.random)? 'random' : 'ordered');

        this.add_child(this._prev);
        this.add_child(this._random);
        this.add_child(this._next);
    }

    _addKeyBinding(key, handler) {
        let success = false;
        success = Main.wm.addKeybinding(
            key,
            Interface.settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            handler
        );

        this._bindings.push(key);
        if (success) {
            Logger.debug('added keybinding ' + key);
        } else {
            Logger.debug('failed to add keybinding ' + key);
            Logger.debug(success);
        }
    }

    _removeKeyBinding(key) {
        if (this._bindings.indexOf(key)) {
            this._bindings.splice(this._bindings.indexOf(key), 1);
        }

        Logger.debug('removing keybinding ' + key);
        Main.wm.removeKeybinding(key);
    }
}
);

export const OpenCurrentMenuItem = GObject.registerClass(
class DeskChangerPopupMenuOpenCurrent extends PopupMenu.PopupMenuItem {
    _init() {
        super._init(_('Open current wallpaper'));
        this._background = new Gio.Settings({'schema': 'org.gnome.desktop.background'});
        this._activate_id = this.connect('activate', () => {
            Logger.debug(`opening current wallpaper ${this._background.get_string('picture-uri')}`);
            Gio.AppInfo.launch_default_for_uri(this._background.get_string('picture-uri'), global.create_app_launch_context(0, -1));
        });
        Logger.debug(`connect active (${this._activate_id})`);
    }

    destroy() {
        Logger.debug(`disconnect active (${this._activate_id})`);
        this.disconnect(this._activate_id);

        super.destroy();
    }
}
);

export const PopupMenuItem = GObject.registerClass(
class DeskChangerPopupMenuItem extends PopupMenu.PopupMenuItem {
    _init(label, value, key) {
        super._init(label);
        this._value = value;
        this._key = key;
        this._key_normalized = key.replace('_', '-');

        if (Interface.settings[this._key] === this._value) {
            this.setOrnament(PopupMenu.Ornament.DOT);
        }

        this._handler_key_changed = Interface.settings.connect(`changed::${this._key_normalized}`, () => {
            if (Interface.settings[key] === value) {
                this.setOrnament(PopupMenu.Ornament.DOT);
            } else {
                this.setOrnament(PopupMenu.Ornament.NONE);
            }
        });

        this._handler_id = this.connect('activate', () => {
            Interface.settings[key] = value;
        });
    }

    destroy() {
        if (this._handler_key_changed) {
            Interface.settings.disconnect(this._handler_key_changed);
            this._handler_key_changed = null;
        }

        if (this._handler_id) {
            this.disconnect(this._handler_id);
            this._handler_id = null;
        }

        super.destroy();
    }
}
);

export const PopupSubMenuMenuItem = GObject.registerClass(
class DeskChangerPopupSubMenuMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init(prefix, key, sensitive=true) {
        super._init(`${prefix}: ${Interface.settings[key]}`);
        this._prefix = prefix;
        this._changed_id = Interface.settings.connect(`changed::${key.replace('_', '-')}`, () => {
            this.setLabel(Interface.settings[key]);
        });
        this.setSensitive(sensitive);
    }

    destroy() {
        if (this._changed_id) {
            Interface.settings.disconnect(this._changed_id);
        }

        super.destroy();
    }

    setLabel(label) {
        this.label.text = `${this._prefix}: ${label}`;
    }
}
);

export const PreviewMenuItem = GObject.registerClass(
class DeskChangerPopupMenuPreviewMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(daemon) {
        super._init({reactive: true});
        this._box = new St.BoxLayout({vertical: true});
        this.add_actor(this._box);
        this._prefix = new St.Label({text: _('Open next wallpaper')});
        this._box.add(this._prefix);
        this._preview = new DeskChangerControl.PreviewControl(220, daemon);
        this._box.add(this._preview);
        this._activate_id = this.connect('activate', () => {
            if (this._preview.file) {
                Logger.debug(`opening file ${this._preview.file}`);
                Gio.AppInfo.launch_default_for_uri(this._preview.file, global.create_app_launch_context(0, -1));
            } else {
                Utils.error('no preview set');
            }
        });
        Logger.debug(`connect activate ${this._activate_id}`);
    }

    destroy() {
        Logger.debug(`disconnect activate ${this._activate_id}`);
        this.disconnect(this._activate_id);

        this._preview.destroy();
        this._prefix.destroy();
        this._box.destroy();
        super.destroy();
    }
}
);

export const ProfileMenuItem = GObject.registerClass({
    Abstract: true,
},
class DeskChangerPopupSubMenuMenuItemProfile extends PopupSubMenuMenuItem {
    _init(label, key, sensitive=true) {
        super._init(label, key, Interface.settings, sensitive);
        this._profiles_changed_id = Interface.settings.connect('changed::profiles', () => {
            this._populate_profiles(key);
        });
        this._populate_profiles(key);
    }

    destroy() {
        Interface.settings.disconnect(this._profiles_changed_id);
        super.destroy();
    }

    _populate_profiles(key) {
        this.menu.removeAll();
        for (let index in Interface.settings.profiles) {
            let item = new PopupMenuItem(index, index, key);
            this.menu.addMenuItem(item);
        }
    }
}
);

export const ProfileDesktopMenuItem = GObject.registerClass(
class DeskChangerPopupSubMenuMenuItemProfileDesktop extends ProfileMenuItem {
    _init(sensitive = true) {
        super._init(_('Desktop Profile'), 'current_profile', sensitive);
    }
}
);
