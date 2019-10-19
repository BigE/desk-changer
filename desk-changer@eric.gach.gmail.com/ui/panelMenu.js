const Me = imports.misc.extensionUtils.getCurrentExtension();
const PopupMenu = Me.imports.ui.popupMenu;

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;

var Button = GObject.registerClass(
class DeskChangerPanelMenuButton extends PanelMenu.Button {
    _init(daemon, settings) {
        super._init(0.0, 'DeskChanger');
        this._daemon = daemon;

        this._icon = new Icon(this._daemon, settings);
        this.add_child(this._icon);
        this.menu.addMenuItem(new PopupMenu.ProfileDesktop(settings));
    }

    destroy() {
        this._icon.destroy();
        super.destroy();
    }
}
);

let Icon = GObject.registerClass(
class DeskChangerPanelMenuIcon extends St.Bin {
    _init(daemon, settings) {
        this._daemon = daemon;
        this._settings = settings;
        this._gicon = Gio.icon_new_for_string(Me.path + '/icons/wallpaper-icon.png');
        super._init({
            style_class: 'panel-status-menu-box',
        });
        this._icon = null;
        this._preview = null;
        this.update_child();

        this._preview_id = settings.connect('changed::icon-preview', (settings, key) => {
            this.update_child(this._daemon.desktop_profile.preview);
        });

        this._daemon.desktop_profile.connect('preview', (instance, uri) => {
            if (this._preview) {
                this.update_child(uri);
            }
        });
    }

    destroy() {
        if (this._preview_id) {
            this._settings.disconnect(this._preview_id);
        }

        this._destroy_icon();
        this._destroy_preview();
        super.destroy();
    }

    update_child(file) {
        if (this._settings.icon_preview && this._create_preview(file)) {
            this.set_child(this._preview);
            this._destroy_icon();
        } else if (!(this._icon)) {
            this._icon = new St.Icon({
                gicon: this._gicon,
                style_class: 'system-status-icon',
            });
            this.set_child(this._icon);
            this._destroy_preview();
        }
    }

    _create_preview(file) {
        this._destroy_preview();
        //this._preview = new DeskChangerPreview(34, this._daemon, this.update_child.bind(this));

        if (!(this._preview.file)) {
            if (typeof file === 'string') {
                this._preview.set_wallpaper(file);
            } else {
                this._destroy_preview();
                return false;
            }
        }

        return true;
    }

    _destroy_icon() {
        if (this._icon) {
            this._icon.destroy();
            this._icon = null;
        }
    }

    _destroy_preview() {
        if (this._preview) {
            this._preview.destroy();
            this._preview = null;
        }
    }
}
);
