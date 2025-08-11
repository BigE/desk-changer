import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

import { APP_PATH } from "../../../common/interface.js";

export default class KeybindDialog extends Adw.Dialog {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiKeybindDialog",
            InternalChildren: [
                'cancel_button',
                'edit_box',
                'remove_button',
                'replace_button',
                'set_button',
                'shortcut_accel_label',
                'stack',
                'standard_box',
                'top_info_label',
            ],
            Properties: {
                'keybind': GObject.param_spec_string(
                    "keybind", "Keybind",
                    "GTK keybind name from Gtk.accelerator_name",
                    null, GObject.ParamFlags.READWRITE
                ),
                'keybind_name': GObject.param_spec_string(
                    'keybind_name', 'Keybind Name',
                    'DeskChanger keybind name to display',
                    null, GObject.ParamFlags.READWRITE
                ),
            },
            Template: `resource://${APP_PATH}/ui/prefs/dialog/keybind.ui`,
        }, this);
    }

    cancel_button: Gtk.Button;
    edit_box: Gtk.Box;
    #keybind?: string;
    #keybind_name: string;
    #keyval?: number;
    #mask?: number;
    remove_button: Gtk.Button;
    replace_button: Gtk.Button;
    set_button: Gtk.Button;
    shortcut_accel_label: Gtk.ShortcutLabel;
    stack: Gtk.Stack;
    standard_box: Gtk.Box;
    top_info_label: Gtk.Label;

    get keybind(): string|null {
        return this.#keybind || null;
    }

    get keybind_name(): string {
        return this.#keybind_name;
    }

    set keybind(value: string | null) {
        this.#keybind = value || undefined;
        this.notify('keybind');
    }

    set keybind_name(value: string) {
        this.#keybind_name = value;
        this.notify('keybind_name');
    }

    constructor(keybind_name: string, keybind?: string, params?: Partial<Adw.Dialog.ConstructorProps>) {
        super(params);

        this.#keybind = keybind;
        this.#keybind_name = keybind_name;

        // @ts-expect-error
        this.cancel_button = this._cancel_button;
        // @ts-expect-error
        this.edit_box = this._edit_box;
        // @ts-expect-error
        this.remove_button = this._remove_button;
        // @ts-expect-error
        this.replace_button = this._replace_button;
        // @ts-expect-error
        this.set_button = this._set_button;
        // @ts-expect-error
        this.shortcut_accel_label = this._shortcut_accel_label;
        // @ts-expect-error
        this.stack = this._stack;
        // @ts-expect-error
        this.standard_box = this._standard_box;
        // @ts-expect-error
        this.top_info_label = this._top_info_label;
    }

    close(): boolean {
        this.#keyval = undefined;
        this.#mask = undefined;

        return super.close();
    }

    vfunc_realize() {
        super.vfunc_realize();

        this.replace_button.set_visible(false);
        this.set_button.set_visible(false);
        this.remove_button.set_visible(Boolean(this.#keybind));
        this.top_info_label.set_markup(`Enter new shortcut to change <b>${this.keybind_name}</b>`);
    }

    _on_key_pressed(widget: Gtk.EventControllerKey, keyval: number, keycode: number, state: Gdk.ModifierType) {
        const event = (widget.get_current_event() as Gdk.KeyEvent) || null;
        const mask = state & (Gtk.accelerator_get_default_mod_mask() | Gdk.ModifierType.SHIFT_MASK)

        if (!event.is_modifier() && mask === Gdk.ModifierType.NO_MODIFIER_MASK && (keyval === Gdk.KEY_BackSpace || keyval === Gdk.KEY_Escape)) {
            if (keyval === Gdk.KEY_BackSpace) {
                this.keybind = null;
                return Gdk.EVENT_STOP;
            }

            return Gdk.EVENT_PROPAGATE;
        }

        this.#set_custom_keybind(keyval, keycode, mask);
        return Gdk.EVENT_STOP;
    }

    _on_save_keybind() {
        if (!this.#keyval || !this.#mask)
            throw new Error('No keybind available to save');

        this.keybind = Gtk.accelerator_name(this.#keyval, this.#mask);
    }

    #accelerator_valid(keyval: number, keycode: number, mask: Gdk.ModifierType): boolean {
        if ((mask === 0 || mask === Gdk.ModifierType.SHIFT_MASK) && keycode != 0) {
            if (
                (keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z)
                || (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z)
                || (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9)
                || (keyval == Gdk.KEY_space && mask === 0)
            ) {
                return false;
            }
        }

        return true;
    }

    #set_custom_keybind(keyval: number, keycode: number, mask: Gdk.ModifierType) {
        if (!Gtk.accelerator_valid(keyval, mask) || !this.#accelerator_valid(keyval, keycode, mask))
            return;

        const has_user_value = Boolean(this.#keybind);

        this.shortcut_accel_label.set_accelerator(Gtk.accelerator_name(keyval, mask));
        this.stack.set_visible_child(this.standard_box);
        this.replace_button.set_visible(has_user_value);
        this.set_button.set_visible(!has_user_value);
        this.#keyval = keyval;
        this.#mask = mask;
    }
}
