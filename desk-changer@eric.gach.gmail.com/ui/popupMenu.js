const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata.uuid);
const Utils = Me.imports.utils;
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
    _init(daemon, settings) {
        super._init({'can_focus': false, 'reactive': false});
        this._bindings = [];

        this._addKeyBinding('next-wallpaper', () => {
            daemon.next();
        }, settings);
        this._addKeyBinding('prev-wallpaper', () => {
            daemon.prev();
        }, settings);

        this._next = new DeskChangerControl.ButtonControl('media-skip-forward', () => {
            daemon.next();
        });
        this._prev = new DeskChangerControl.ButtonControl('media-skip-backward', () => {
            if (!daemon.prev()) {
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
            Utils.debug(`setting order to ${state}`);
            settings.random = (state === 'random');
        });
        this._random.set_state((settings.random)? 'random' : 'ordered');

        this.add(this._prev, {expand: true, x_fill: false});
        this.add(this._random, {expand: true, x_fill: false});
        this.add(this._next, {expand: true, x_fill: false});
    }

    _addKeyBinding(key, handler, settings) {
        let success = false;
        success = Main.wm.addKeybinding(
            key,
            settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            handler
        );

        this._bindings.push(key);
        if (success) {
            Utils.debug('added keybinding ' + key);
        } else {
            Utils.debug('failed to add keybinding ' + key);
            Utils.debug(success);
        }
    }

    _removeKeyBinding(key) {
        if (this._bindings.indexOf(key)) {
            this._bindings.splice(this._bindings.indexOf(key), 1);
        }

        Utils.debug('removing keybinding ' + key);
        Main.wm.removeKeybinding(key);
    }
}
);

var DaemonMenuItem = GObject.registerClass(
class DeskChangerPopupMenuDaemonMenuItem extends PopupMenu.PopupSwitchMenuItem {
    _init(daemon) {
        super._init(_('DeskChanger Daemon'), daemon.running);
        this._daemon = daemon;
        this._toggled_id = this.connect('toggled', () => {
            (daemon.running)? daemon.stop() : daemon.start();
        });
        this._daemon_id = daemon.connect('toggled', () => {
            this.setToggleState(daemon.running);
        });
    }

    destroy() {
        if (this._toggled_id) {
            this.disconnect(this._toggled_id);
        }
        this._toggled_id = null;

        if (this._daemon_id) {
            this._daemon.disconnect(this._daemon_id);
        }
        this._daemon_id = null;

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
            Utils.debug(`opening current wallpaper ${this._background.get_string('picture-uri')}`);
            Util.spawn(['xdg-open', this._background.get_string('picture-uri')]);
        });
        Utils.debug(`connect active (${this._activate_id})`);
    }

    destroy() {
        Utils.debug(`disconnect active (${this._activate_id})`);
        this.disconnect(this._activate_id);

        super.destroy();
    }
}
);

let PopupMenuItem = GObject.registerClass(
class DeskChangerPopupMenuItem extends PopupMenu.PopupMenuItem {
    _init(label, value, settings, key) {
        super._init(label);
        this._value = value;
        this._key = key;
        this._key_normalized = key.replace('_', '-');
        this._settings = settings;

        if (settings[this._key] === this._value) {
            this.setOrnament(PopupMenu.Ornament.DOT);
        }

        this._handler_key_changed = settings.connect(`changed::${this._key_normalized}`, () => {
            if (settings[key] === value) {
                this.setOrnament(PopupMenu.Ornament.DOT);
            } else {
                this.setOrnament(PopupMenu.Ornament.NONE);
            }
        });

        this._handler_id = this.connect('activate', () => {
            settings[key] = value;
        });
    }

    destroy() {
        if (this._handler_key_changed) {
            this._settings.disconnect(this._handler_key_changed);
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
    _init(prefix, key, settings, sensitive=true) {
        super._init(`${prefix}: ${settings[key]}`);
        this._prefix = prefix;
        this._settings = settings;
        this._changed_id = settings.connect(`changed::${key.replace('_', '-')}`, () => {
            this.setLabel(settings[key]);
        });
        this.setSensitive(sensitive);
    }

    destroy() {
        if (this._changed_id) {
            this._settings.disconnect(this._changed_id);
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
                Utils.debug(`opening file ${this._preview.file}`);
                Util.spawn(['xdg-open', this._preview.file]);
            } else {
                Utils.error('no preview set');
            }
        });
        Utils.debug(`connect activate ${this._activate_id}`);
    }

    destroy() {
        Utils.debug(`disconnect activate ${this._activate_id}`);
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
    _init(label, key, settings, sensitive=true) {
        super._init(label, key, settings, sensitive);
        this._settings = settings;
        this._profiles_changed_id = settings.connect('changed::profiles', () => {
            this._populate_profiles(settings, key);
        });
        this._populate_profiles(settings, key);
    }

    destroy() {
        this._settings.disconnect(this._profiles_changed_id);
        super.destroy();
    }

    _populate_profiles(settings, key) {
        this.menu.removeAll();
        for (let index in settings.profiles) {
            let item = new PopupMenuItem(index, index, settings, key);
            this.menu.addMenuItem(item);
        }
    }
}
);

var ProfileDesktopMenuItem = GObject.registerClass(
class DeskChangerPopupSubMenuMenuItemProfileDesktop extends ProfileMenuItem {
    _init(settings, sensitive = true) {
        super._init(_('Desktop Profile'), 'current_profile', settings, sensitive);
    }
}
);

var ProfileLockScreenMenuItem = GObject.registerClass(
class DeskChangerPopupSubMenuMenuItemProfileLockScreen extends ProfileMenuItem {
    _init(settings, sensitive=true) {
        super._init(_('Lock Screen Profile'), 'lockscreen_profile', settings, sensitive);
    }

    setLabel(label) {
        if (!label) {
            label = '(inherited)';
        }

        super.setLabel(label);
    }

    _populate_profiles(settings, key) {
        super._populate_profiles(settings, 'lockscreen_profile', key);

        let inherit = new PopupMenuItem(_('(inherit from desktop)'), '', settings, key);
        this.menu.addMenuItem(inherit);
    }
}
);

var RotationMenuItem = GObject.registerClass(
class DeskChangerPopupMenuRotationMenuItem extends PopupSubMenuMenuItem {
    _init(settings, sensitive=true) {
        super._init(_('Rotation mode'), 'rotation', settings, sensitive);
        this.menu.addMenuItem(new PopupMenuItem(_('Interval timer'), 'interval', settings, 'rotation'));
        this.menu.addMenuItem(new PopupMenuItem(_('Beginning of hour'), 'hourly', settings, 'rotation'));
        this.menu.addMenuItem(new PopupMenuItem(_('Disabled'), 'disabled', settings, 'rotation'));
    }
}
);

var SwitchMenuItem = GObject.registerClass(
class DeskChangerPopupSwitchMenuItem extends PopupMenu.PopupSwitchMenuItem {
    _init(label, key, settings) {
        super._init(label, settings[key]);
        this._settings = settings;
        this._key = key;
        this._key_normalized = key.replace('_', '-');
        this._handler_changed = settings.connect(`changed::${this._key_normalized}`, (settings, key) => {
            this.setToggleState(settings.get_boolean(key));
        });
        this._handler_toggled = this.connect('toggled', () => {
            this._settings[this._key] = this.state;
        });
    }

    destroy() {
        if (this._handler_changed) {
            this._settings.disconnect(this._handler_changed);
        }

        if (this._handler_toggled) {
            this._settings.disconnect(this._handler_toggled);
        }

        super.destroy();
    }
}
);
