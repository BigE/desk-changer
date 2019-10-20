const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata.uuid);
const Utils = Me.imports.utils;
const DeskChangerPreview = Me.imports.ui.preview.Preview;

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;
const _ = Gettext.gettext;

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

        this._handler_key_changed = settings.connect(`changed::${this._key_normalized}`, (settings, key) => {
            if (settings[key] === this._value) {
                this.setOrnament(PopupMenu.Ornament.DOT);
            } else {
                this.setOrnament(PopupMenu.Ornament.NONE);
            }
        });

        this._handler_id = this.connect('activate', (value, settings, key) => {
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

let PopupSubMenuMenuItem = GObject.registerClass({
    Abstract: true,
},
class DeskChangerPopupSubMenuMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init(prefix, key, settings, sensitive=true) {
        super._init('');
        this._settings = settings;
        this._prefix = prefix;
        this._key = key;
        this._key_normalized = key.replace('_', '-');
        this._changed_id = settings.connect(`changed::${this._key_normalized}`, this.setLabel.bind(this));
        this.setLabel(settings, key);
        this.setSensitive(sensitive);
    }

    destroy() {
        if (this._changed_id) {
            this._settings.disconnect(this._changed_id);
        }

        super.destroy();
    }

    setLabel(settings, key) {
        this.label.text = `${this._prefix}: ${settings[key]}`;
    }
}
);

var PreviewMenuItem = GObject.registerClass(
class DeskChangerPopupMenuPreviewMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(daemon) {
        super._init({reactive: true});
        this._box = new St.BoxLayout({vertical: true});
        this.add_actor(this._box, {align: St.Align.MIDDLE, span: -1});
        this._prefix = new St.Label({text: _('Open next wallpaper')});
        this._box.add(this._prefix);
        this._preview = new DeskChangerPreview(220, daemon);
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
        this._populate_profiles(settings);
    }

    _populate_profiles(settings) {
        this.menu.removeAll();
        for (let index in settings.profiles) {
            Utils.debug(`adding menu: ${index} -> ${this._prefix}`);
            let item = new PopupMenuItem(index, index, settings, this._key);
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

    setLabel(settings, key) {
        let value = settings[key];

        if (value === '' || value === settings.current_profile) {
            value = _('(inherited)');
        }

        this.label.text = _('Lock Screen Profile') + ':' + value;
    }

    _populate_profiles(settings) {
        super._populate_profiles(settings);

        let inherit = new PopupMenuItem(_('(inherit from desktop)'), '', settings, this._key);
        this.menu.addMenuItem(inherit);
    }
}
);

var SwitchMenuItem = GObject.registerClass(
class DeskChangerPopupSwitchMenuItem extends PopupMenu.PopupSwitchMenuItem {
    _init(label, key, settings) {
        super._init(label);
        this._settings = settings;
        this._key = key;
        this._key_normalized = key.replace('_', '-');
        this.setToggleState(settings[key]);
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
