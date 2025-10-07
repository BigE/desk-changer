import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import KeyboardShortcutRow from './shortcut_row.js';

export default class KeyboardPage extends Adw.PreferencesPage {
    keymap_listbox: Gtk.ListBox;
    #next?: KeyboardShortcutRow;
    #next_activated_id?: number;
    #next_changed_id?: number;
    #previous?: KeyboardShortcutRow;
    #previous_activated_id?: number;
    #previous_changed_id?: number;
    #settings?: Gio.Settings;

    constructor(settings: Gio.Settings) {
        super();

        // @ts-expect-error Bind property from resource file
        this.keymap_listbox = this._keymap_listbox;
        this.#settings = settings;
    }

    destroy() {
        this.keymap_listbox.remove_all();
        this.#settings = undefined;
    }

    vfunc_realize() {
        super.vfunc_realize();

        this.#next = new KeyboardShortcutRow(
            'next-wallpaper',
            this.#settings!.get_strv('next-wallpaper').join(' '),
            {title: 'Next Wallpaper'}
        );

        if (!this.#next.accelerator_label)
            throw TypeError();

        this.#next_changed_id = this.#settings?.connect(
            'changed::next-wallpaper',
            () => {
                this.#next!.accelerator_label!.accelerator = this.#settings?.get_strv('next-wallpaper').join(' ') || '';
            }
        );
        this.#next_activated_id = this.#next.connect(
            'activated',
            this.#on_keyboard_shortcut_row_activate.bind(this)
        );
        this.keymap_listbox.append(this.#next);
        this.#previous = new KeyboardShortcutRow(
            'previous-wallpaper',
            this.#settings!.get_strv('previous-wallpaper').join(' '),
            {title: 'Previous Wallpaper'}
        );

        if (!this.#previous.accelerator_label)
            throw TypeError();

        this.#previous_changed_id = this.#settings?.connect(
            'changed::previous-wallpaper',
            () => {
                this.#previous!.accelerator_label!.accelerator = this.#settings?.get_strv('previous-wallpaper').join(' ') || '';
            }
        );
        this.#previous_activated_id = this.#previous.connect(
            'activated',
            this.#on_keyboard_shortcut_row_activate.bind(this)
        );
        this.keymap_listbox.append(this.#previous);
    }

    vfunc_unrealize() {
        if (this.#next_activated_id) {
            this.#next!.disconnect(this.#next_activated_id);
            this.#next_activated_id = undefined;
        }

        if (this.#next_changed_id) {
            this.#settings!.disconnect(this.#next_changed_id);
            this.#next_changed_id = undefined;
        }

        if (this.#next) {
            this.keymap_listbox.remove(this.#next);
        }

        if (this.#previous_activated_id) {
            this.#previous!.disconnect(this.#previous_activated_id);
            this.#previous_activated_id = undefined;
        }

        if (this.#previous_changed_id) {
            this.#settings!.disconnect(this.#previous_changed_id);
            this.#previous_changed_id = undefined;
        }

        if (this.#previous) {
            this.keymap_listbox.remove(this.#previous);
        }

        this.#next = undefined;
        this.#previous = undefined;
        super.vfunc_unrealize();
    }

    #on_keyboard_shortcut_row_activate(widget: KeyboardShortcutRow) {
        import('../dialog/keybind.js').then(keybind => {
            const KeybindDialog = keybind.default;
            const dialog = new KeybindDialog(widget.get_title());

            dialog.connect('notify::keybind', () => {
                if (!dialog.keybind) this.#settings!.reset(widget.keybind);
                else this.#settings!.set_strv(widget.keybind, Array(dialog.keybind));
                dialog.close();
            });
            dialog.present(this.get_root());
        });
    }
}
