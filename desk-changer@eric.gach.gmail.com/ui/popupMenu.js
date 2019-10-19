const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata.uuid);
const Utils = Me.imports.utils;

const GObject = imports.gi.GObject;
const PopupMenu = imports.ui.popupMenu;
const _ = Gettext.gettext;

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

        this._handler_key_changed = settings.connect('changed::' + this._key_normalized, (settings, key) => {
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
        this._changed_id = settings.connect('changed::%s'.format(this._key_normalized), this.setLabel.bind(this));
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
        this.label.text = '%s: %s'.format(this._prefix, settings[key]);
    }
}
);

let Profile = GObject.registerClass({
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
            Utils.debug('adding menu: %s -> %s'.format(index, this._prefix));
            let item = new PopupMenuItem(index, index, settings, this._key);
            this.menu.addMenuItem(item);
        }
    }
}
);

var ProfileDesktop = GObject.registerClass(
class DeskChangerPopupSubMenuMenuItemProfileDesktop extends Profile {
    _init(settings, sensitive = true) {
        super._init(_('Desktop Profile'), 'current_profile', settings, sensitive);
    }
}
);
