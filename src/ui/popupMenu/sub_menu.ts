import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

const PopupMenuMenuItemSubMenu = GObject.registerClass(
class DeskChangerUiPopupMenuMenuItemSubMenu extends PopupMenu.PopupSubMenuMenuItem {
    #changed_id?: number;
    #settings?: Gio.Settings;

    constructor(settings: Gio.Settings, prefix: string, key: string, sensitive: boolean = true) {
        const value = settings.get_string(key);
        super(`${prefix}: ${value}`);

        this.#settings = settings;
        this.#changed_id = this.#settings.connect(`changed::${key}`, () => {
            this.set_label(`${prefix}: ${this.#settings!.get_string(key)}`);
        });
    }

    destroy() {
        if (this.#changed_id && this.#settings) {
            this.#settings.disconnect(this.#changed_id);
            this.#changed_id = undefined;
        }

        this.#settings = undefined;
        super.destroy();
    }

    set_label(label: string): void {
        this.label.text = label;
    }
}
);

export default PopupMenuMenuItemSubMenu;
export type PopupMenuMenuItemSubMenuType = InstanceType<typeof PopupMenuMenuItemSubMenu>;
