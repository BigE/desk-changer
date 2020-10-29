'use strict';

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata.uuid);
const DeskChangerControl = Me.imports.ui.control;

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;
const _ = Gettext.gettext;

var ControlsMenuItem = GObject.registerClass(
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
            deskchanger.debug(`setting order to ${state}`);
            deskchanger.settings.random = (state === 'random');
        });
        this._random.set_state((deskchanger.settings.random)? 'random' : 'ordered');

        this.add_child(this._prev);
        this.add_child(this._random);
        this.add_child(this._next);
    }

    _addKeyBinding(key, handler) {
        let success = false;
        success = Main.wm.addKeybinding(
            key,
            deskchanger.settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            handler
        );

        this._bindings.push(key);
        if (success) {
            deskchanger.debug('added keybinding ' + key);
        } else {
            deskchanger.debug('failed to add keybinding ' + key);
            deskchanger.debug(success);
        }
    }

    _removeKeyBinding(key) {
        if (this._bindings.indexOf(key)) {
            this._bindings.splice(this._bindings.indexOf(key), 1);
        }

        deskchanger.debug('removing keybinding ' + key);
        Main.wm.removeKeybinding(key);
    }
}
);

var DaemonMenuItem = GObject.registerClass(
class DeskChangerPopupMenuDaemonMenuItem extends PopupMenu.PopupSwitchMenuItem {
    _init(daemon) {
        super._init(_('DeskChanger Daemon'), daemon.Running);
        this._daemon = daemon;

        this._toggled_id = this.connect('toggled', (object, state) => {
            deskchanger.debug('toggling daemon state');

            try {
                (state === true)? this._daemon.StartSync() : this._daemon.StopSync();
            } catch (e) {
                deskchanger.error(e, 'Failed to toggle daemon');
            }
        });

        this._running_id = this._daemon.connectSignal('Running', (proxy, name, [state]) => {
            deskchanger.debug(`upating switch to ${(state === true)? '' : 'not '}toggled`);
            this.setToggleState(state);
        });
    }

    destroy() {
        if (this._toggled_id) {
            this.disconnect(this._toggled_id);
        }
        this._toggled_id = null;

        if (this._running_id) {
            this._daemon.disconnectSignal(this._running_id);
        }
        this._running_id = null;

        super.destroy();
    }
}
);

var OpenCurrentMenuItem = GObject.registerClass(
class DeskChangerPopupMenuOpenCurrent extends PopupMenu.PopupMenuItem {
    _init() {
        super._init(_('Open current wallpaper'));
        this._background = new Gio.Settings({'schema': 'org.gnome.desktop.background'});
        this._activate_id = this.connect('activate', () => {
            deskchanger.debug(`opening current wallpaper ${this._background.get_string('picture-uri')}`);
            Util.spawn(['xdg-open', this._background.get_string('picture-uri')]);
        });
        deskchanger.debug(`connect active (${this._activate_id})`);
    }

    destroy() {
        deskchanger.debug(`disconnect active (${this._activate_id})`);
        this.disconnect(this._activate_id);

        super.destroy();
    }
}
);

let PopupMenuItem = GObject.registerClass(
class DeskChangerPopupMenuItem extends PopupMenu.PopupMenuItem {
    _init(label, value, key) {
        super._init(label);
        this._value = value;
        this._key = key;
        this._key_normalized = key.replace('_', '-');

        if (deskchanger.settings[this._key] === this._value) {
            this.setOrnament(PopupMenu.Ornament.DOT);
        }

        this._handler_key_changed = deskchanger.settings.connect(`changed::${this._key_normalized}`, () => {
            if (deskchanger.settings[key] === value) {
                this.setOrnament(PopupMenu.Ornament.DOT);
            } else {
                this.setOrnament(PopupMenu.Ornament.NONE);
            }
        });

        this._handler_id = this.connect('activate', () => {
            deskchanger.settings[key] = value;
        });
    }

    destroy() {
        if (this._handler_key_changed) {
            deskchanger.settings.disconnect(this._handler_key_changed);
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

let PopupSubMenuMenuItem = GObject.registerClass(
class DeskChangerPopupSubMenuMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init(prefix, key, sensitive=true) {
        super._init(`${prefix}: ${deskchanger.settings[key]}`);
        this._prefix = prefix;
        this._changed_id = deskchanger.settings.connect(`changed::${key.replace('_', '-')}`, () => {
            this.setLabel(deskchanger.settings[key]);
        });
        this.setSensitive(sensitive);
    }

    destroy() {
        if (this._changed_id) {
            deskchanger.settings.disconnect(this._changed_id);
        }

        super.destroy();
    }

    setLabel(label) {
        this.label.text = `${this._prefix}: ${label}`;
    }
}
);

var PreviewMenuItem = GObject.registerClass(
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
                deskchanger.debug(`opening file ${this._preview.file}`);
                Util.spawn(['xdg-open', this._preview.file]);
            } else {
                Utils.error('no preview set');
            }
        });
        deskchanger.debug(`connect activate ${this._activate_id}`);
    }

    destroy() {
        deskchanger.debug(`disconnect activate ${this._activate_id}`);
        this.disconnect(this._activate_id);

        this._preview.destroy();
        this._prefix.destroy();
        this._box.destroy();
        super.destroy();
    }
}
);

let ProfileMenuItem = GObject.registerClass({
    Abstract: true,
},
class DeskChangerPopupSubMenuMenuItemProfile extends PopupSubMenuMenuItem {
    _init(label, key, sensitive=true) {
        super._init(label, key, deskchanger.settings, sensitive);
        this._profiles_changed_id = deskchanger.settings.connect('changed::profiles', () => {
            this._populate_profiles(key);
        });
        this._populate_profiles(key);
    }

    destroy() {
        deskchanger.settings.disconnect(this._profiles_changed_id);
        super.destroy();
    }

    _populate_profiles(key) {
        this.menu.removeAll();
        for (let index in deskchanger.settings.profiles) {
            let item = new PopupMenuItem(index, index, key);
            this.menu.addMenuItem(item);
        }
    }
}
);

var ProfileDesktopMenuItem = GObject.registerClass(
class DeskChangerPopupSubMenuMenuItemProfileDesktop extends ProfileMenuItem {
    _init(sensitive = true) {
        super._init(_('Desktop Profile'), 'current_profile', sensitive);
    }
}
);

var RotationMenuItem = GObject.registerClass(
class DeskChangerPopupMenuRotationMenuItem extends PopupSubMenuMenuItem {
    _init(sensitive=true) {
        super._init(_('Rotation mode'), 'rotation', sensitive);
        this.menu.addMenuItem(new PopupMenuItem(_('Interval timer'), 'interval', 'rotation'));
        this.menu.addMenuItem(new PopupMenuItem(_('Beginning of hour'), 'hourly', 'rotation'));
        this.menu.addMenuItem(new PopupMenuItem(_('Disabled'), 'disabled', 'rotation'));
    }
}
);

var SwitchMenuItem = GObject.registerClass(
class DeskChangerPopupSwitchMenuItem extends PopupMenu.PopupSwitchMenuItem {
    _init(label, key) {
        super._init(label, deskchanger.settings[key]);
        this._key = key;
        this._key_normalized = key.replace('_', '-');
        this._handler_changed = deskchanger.settings.connect(`changed::${this._key_normalized}`, (settings, key) => {
            this.setToggleState(deskchanger.settings.get_boolean(key));
        });
        this._handler_toggled = this.connect('toggled', () => {
            deskchanger.settings[this._key] = this.state;
        });
    }

    destroy() {
        if (this._handler_changed) {
            deskchanger.settings.disconnect(this._handler_changed);
        }

        if (this._handler_toggled) {
            deskchanger.settings.disconnect(this._handler_toggled);
        }

        super.destroy();
    }
}
);
