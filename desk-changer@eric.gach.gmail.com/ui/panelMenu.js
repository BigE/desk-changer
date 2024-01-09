'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';

import DeskChanger from '../deskchanger.js';
import Interface from '../daemon/interface.js';
import * as DeskChangerControl from './control.js';
import * as DeskChangerPopupMenu from './popupMenu.js';

export const Button = GObject.registerClass(
class DeskChangerPanelMenuButton extends PanelMenu.Button {
    _init(daemon) {
        super._init(0.0, 'DeskChanger');
        this._daemon = daemon;

        this._icon = new Icon(daemon);
        this.add_child(this._icon);
        this.menu.addMenuItem(new DeskChangerPopupMenu.ProfileDesktopMenuItem());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerPopupMenu.PreviewMenuItem(daemon));
        this.menu.addMenuItem(new DeskChangerPopupMenu.ControlsMenuItem(daemon));
        this.menu.addMenuItem(new DeskChangerPopupMenu.OpenCurrentMenuItem());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let menu_item = new PopupMenu.PopupMenuItem(_('DeskChanger Settings'));
        menu_item.connect('activate', () => {
            const extensionObject = Extension.lookupByUUID(DeskChanger.metadata.uuid);
            extensionObject.openPreferences();
        });
        this.menu.addMenuItem(menu_item);
    }

    destroy() {
        this._icon.destroy();
        super.destroy();
    }
}
);

export const Icon = GObject.registerClass(
class DeskChangerPanelMenuIcon extends St.Bin {
    _init(daemon) {
        this._daemon = daemon;
        this._gicon = Gio.icon_new_for_string(`resource://${DeskChanger.app_path}/icons/wallpaper-icon.svg`);
        super._init({
            style_class: 'panel-status-menu-box',
        });
        this._icon = null;
        this._preview = null;
        this.update_child(this._daemon.Preview);

        this._preview_id = Interface.settings.connect('changed::icon-preview', (settings, key) => {
            this.update_child(this._daemon.Preview);
        });
    }

    destroy() {
        if (this._preview_id) {
            Interface.settings.disconnect(this._preview_id);
        }

        this._destroy_icon();
        this._destroy_preview();
        super.destroy();
    }

    update_child(file) {
        if (Interface.settings.icon_preview && this._create_preview(file)) {
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
