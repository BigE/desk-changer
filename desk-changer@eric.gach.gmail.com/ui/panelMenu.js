const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const DeskChangerPopupMenu = Me.imports.ui.popupMenu;
const DeskChangerControl = Me.imports.ui.control;

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;

var Button = GObject.registerClass(
class DeskChangerPanelMenuButton extends PanelMenu.Button {
    _init(daemon, settings) {
        super._init(0.0, 'DeskChanger');
        this._daemon = daemon;
        this._settings = settings;
        this._has_lockscreen = Convenience.checkShellVersion('3.35', '<');

        this._icon = new Icon(daemon, settings);
        this.add_child(this._icon);
        this.menu.addMenuItem(new DeskChangerPopupMenu.ProfileDesktopMenuItem(settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerPopupMenu.SwitchMenuItem(_('Notifications'), 'notifications', settings));
        this.menu.addMenuItem(new DeskChangerPopupMenu.SwitchMenuItem(_('Remember profile state'), 'remember_profile_state', settings));
        // it looks like the lockscreen background is removed in 3.36
        if (this._has_lockscreen) {
            this.menu.addMenuItem(new DeskChangerPopupMenu.SwitchMenuItem(_('Update lock screen'), 'update_lockscreen', settings));
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerPopupMenu.PreviewMenuItem(daemon));
        this.menu.addMenuItem(new DeskChangerPopupMenu.ControlsMenuItem(daemon, settings));
        this.menu.addMenuItem(new DeskChangerPopupMenu.OpenCurrentMenuItem());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerPopupMenu.RotationMenuItem(settings));
        this.menu.addMenuItem(new DeskChangerPopupMenu.DaemonMenuItem(daemon));

        let menu_item = new PopupMenu.PopupMenuItem(_('DeskChanger Settings'));
        menu_item.connect('activate', function () {
            Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
        });
        this.menu.addMenuItem(menu_item);

        if (this._has_lockscreen) {
            if (settings.update_lockscreen) {
                this.menu.addMenuItem(new DeskChangerPopupMenu.ProfileLockScreenMenuItem(settings), 1);
            }

            this._update_lockscreen_id = settings.connect('changed::update-lockscreen', (settings, key) => {
                if (settings.update_lockscreen) {
                    this.menu.addMenuItem(new DeskChangerPopupMenu.ProfileLockScreenMenuItem(settings), 1);
                } else {
                    this.menu.box.get_children().map((actor) => {
                        return actor._delegate;
                    }).filter((item) => {
                        item instanceof DeskChangerPopupMenu.ProfileLockScreenMenuItem && item.destroy();
                    });
                }
            });
        }
    }

    destroy() {
        this._icon.destroy();

        if (this._update_lockscreen_id) {
            this._settings.disconnect(this._update_lockscreen_id);
        }

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
        this._preview = new DeskChangerControl.PreviewControl(34, this._daemon, this.update_child.bind(this));

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
