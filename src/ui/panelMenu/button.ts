import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import PanelMenuIcon, {PanelMenuIconType} from "./icon.js";
import PopupMenuProfile from "../popupMenu/profile.js";

const PanelMenuButton = GObject.registerClass(
class DeskChangerUiPanelMenuButton extends PanelMenu.Button {
    declare menu: PopupMenu.PopupMenu;
    #icon?: PanelMenuIconType;
    #settings_menu_item?: PopupMenu.PopupMenuItem;
    #settings_activate_id?: number;

    constructor(uuid: string, settings: Gio.Settings, callback: () => void) {
        super(0.0, uuid);

        this.#icon = new PanelMenuIcon(settings);
        this.add_child(this.#icon);

        // Now load in the menu itself
        this.menu.addMenuItem(new PopupMenuProfile(settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // controls
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // TODO: write controls once the service exists
        // settings
        this.#settings_menu_item = new PopupMenu.PopupMenuItem("DeskChanger Settings");
        this.#settings_activate_id = this.#settings_menu_item.connect('activate', () => callback());
        this.menu.addMenuItem(this.#settings_menu_item);
    }

    destroy() {
        if (this.#settings_menu_item) {
            if (this.#settings_activate_id) {
                this.#settings_menu_item.disconnect(this.#settings_activate_id);
                this.#settings_activate_id = undefined;
            }

            this.#settings_menu_item.destroy();
            this.#settings_menu_item = undefined;
        }

        this.#icon?.destroy();
        this.#icon = undefined;
        super.destroy();
    }
}
);

export default PanelMenuButton;
export type PanelMenuButtonType = InstanceType<typeof PanelMenuButton>;
