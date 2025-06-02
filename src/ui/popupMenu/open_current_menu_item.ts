import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js"

/**
 * Simple menu item to open the current wallpaper
 */
export default class OpenCurrentMenuItem extends PopupMenu.PopupMenuItem {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPopupMenuOpenCurrentMenuItem",
        }, this);
    }

    #activate_id?: number;

    constructor() {
        super("Open current wallpaper");

        this.#activate_id = this.connect('activate', () => {
            const background = Gio.Settings.new("org.gnome.desktop.background");
            Gio.AppInfo.launch_default_for_uri(background.get_string('picture-uri'), global.create_app_launch_context(0, -1));
        });
    }

    destroy() {
        if (this.#activate_id) {
            this.disconnect(this.#activate_id);
            this.#activate_id = undefined;
        }

        super.destroy();
    }
}
