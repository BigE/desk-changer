import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

import KeyboardShortcutRow from "./shortcut_row.js";
import GObject from "gi://GObject";

export default class KeyboardPage extends Adw.PreferencesPage {
    keymap_listbox: Gtk.ListBox;
    #next?: KeyboardShortcutRow;
    #next_activated_id?: number;
    #previous?: KeyboardShortcutRow;
    #previous_activated_id?: number;
    #settings?: Gio.Settings;

    constructor(settings: Gio.Settings) {
        super();

        // @ts-expect-error
        this.keymap_listbox = this._keymap_listbox;
        this.#settings = settings;
    }

    destroy() {
        this.keymap_listbox.remove_all();
        this.#settings = undefined;
    }

    vfunc_realize() {
        super.vfunc_realize();

        this.#next = new KeyboardShortcutRow('next-wallpaper', this.#settings!.get_string('next-wallpaper'), {title: "Next Wallpaper"});
        this.#next_activated_id = this.#next.connect('activated', this.#on_keyboard_shortcut_row_activate.bind(this));
        this.#settings!.bind('next-wallpaper', this.#next, 'accelerator', Gio.SettingsBindFlags.DEFAULT);
        this.keymap_listbox.append(this.#next);
        this.#previous = new KeyboardShortcutRow('previous-wallpaper', this.#settings!.get_string('previous-wallpaper'), {title: "Previous Wallpaper"});
        this.#previous_activated_id = this.#previous.connect('activated', this.#on_keyboard_shortcut_row_activate.bind(this));
        this.#settings!.bind('previous-wallpaper', this.#previous, 'accelerator', Gio.SettingsBindFlags.DEFAULT);
        this.keymap_listbox.append(this.#previous);
    }

    vfunc_unrealize() {
        if (this.#next_activated_id) {
            this.#next!.disconnect(this.#next_activated_id);
            this.#next_activated_id = undefined;
        }

        if (this.#next) {
            this.keymap_listbox.remove(this.#next);
        }

        if (this.#previous_activated_id) {
            this.#previous!.disconnect(this.#previous_activated_id);
            this.#previous_activated_id = undefined;
        }

        if (this.#previous) {
            this.keymap_listbox.remove(this.#previous);
        }

        this.#next = undefined;
        this.#previous = undefined;
        super.vfunc_unrealize();

    }

    #on_keyboard_shortcut_row_activate(widget: KeyboardShortcutRow) {
        import("../../dialog/keybind.js").then((keybind) => {
            const KeybindDialog = keybind.default;
            const dialog = new KeybindDialog(widget.get_title());

            dialog.connect('notify::keybind', () => {
                console.log(dialog.keybind)
                if (!dialog.keybind)
                    this.#settings!.reset(widget.keybind);
                else
                    this.#settings!.set_string(widget.keybind, dialog.keybind);
                dialog.close();
            });
            dialog.present(this.get_root());
        });
    }
}
