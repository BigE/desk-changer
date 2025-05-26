import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

export default class PopupMenuItem extends PopupMenu.PopupMenuItem {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPopupMenuPoupuMenuItem",
        }, this);
    }

    #activate_id?: number;
    readonly #key: string;
    #key_changed_id?: number;
    #settings?: Gio.Settings;
    readonly #value: string;

    constructor(settings: Gio.Settings, label: string, value: string, key: string) {
        super(label);
        this.#settings = settings;
        this.#key = key;
        this.#value = value;

        if (this.#settings.get_string(key) === this.#value) {
            this.setOrnament(PopupMenu.Ornament.DOT);
        }

        this.#key_changed_id = this.#settings.connect(`changed::${key}`, () => this.setOrnament(
            (this.#settings!.get_string(key) === this.#value)? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE
        ));
        this.#activate_id = this.connect('activate', () => { this.#settings!.set_string(this.#key, this.#value) });
    }

    destroy() {
        if (this.#activate_id) {
            this.disconnect(this.#activate_id);
            this.#activate_id = undefined;
        }

        if (this.#key_changed_id && this.#settings) {
            this.#settings.disconnect(this.#key_changed_id);
            this.#key_changed_id = undefined;
        }

        this.#settings = undefined;
        super.destroy();
    }
}
