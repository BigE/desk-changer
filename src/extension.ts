import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class DeskChangerExtension extends Extension {
    #logger?: Console;
    #settings?: Gio.Settings;

    enable() {
        // @ts-ignore
        this.#logger = this.getLogger();
        this.#settings = this.getSettings();
    }

    disable() {
        this.#logger = undefined;
        this.#settings = undefined;
    }
}
