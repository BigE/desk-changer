import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

export default class KeyboardPage extends Adw.PreferencesPage {
    keymap_listbox: Gtk.ListBox;

    constructor() {
        super();

        // @ts-expect-error
        this.keymap_listbox = this._keymap_listbox;
    }
}
