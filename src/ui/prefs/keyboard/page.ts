import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

import KeyboardShortcutRow from "./shortcut_row.js";

export default class KeyboardPage extends Adw.PreferencesPage {
    keymap_listbox: Gtk.ListBox;
    #next?: KeyboardShortcutRow;
    #next_activated_id?: number;
    #previous?: KeyboardShortcutRow;
    #previous_activated_id?: number;
    readonly #settings: Gio.Settings;

    constructor(settings: Gio.Settings) {
        super();

        // @ts-expect-error
        this.keymap_listbox = this._keymap_listbox;
        this.#settings = settings;
    }

    vfunc_realize() {
        super.vfunc_realize();

        this.#next = new KeyboardShortcutRow(this.#settings, 'next-wallpaper', {title: "Next Wallpaper"});
        this.#next_activated_id = this.#next.connect('activated', this.#on_keyboard_shortcut_row_activate.bind(this));
        this.keymap_listbox.append(this.#next);
        this.#previous = new KeyboardShortcutRow(this.#settings, 'previous-wallpaper', {title: "Previous Wallpaper"});
        this.#previous_activated_id = this.#previous.connect('activated', this.#on_keyboard_shortcut_row_activate.bind(this));
        this.keymap_listbox.append(this.#previous);
    }

    vfunc_unrealize() {
        super.vfunc_unrealize();

        if (this.#next_activated_id) {
            this.#next!.disconnect(this.#next_activated_id);
            this.#next_activated_id = undefined;
        }

        if (this.#next) {
            this.keymap_listbox.remove(this.#next);
            this.#next.destroy();
        }

        if (this.#previous_activated_id) {
            this.#previous!.disconnect(this.#previous_activated_id);
            this.#previous_activated_id = undefined;
        }

        if (this.#previous) {
            this.keymap_listbox.remove(this.#previous);
            this.#previous.destroy();
        }

        this.#next = undefined;
        this.#previous = undefined;
    }

    #on_keyboard_shortcut_row_activate(widget: KeyboardShortcutRow) {
    }
}
