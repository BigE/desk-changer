import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

export default class KeyboardShortcutRow extends Adw.ActionRow {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsKeyboardShortcutRow",
            Properties: {
                "keybind": GObject.param_spec_string(
                    "keybind", "Keybind",
                    "The keybind settings item that this row is bound to",
                    null, GObject.ParamFlags.READABLE
                ),
            }
        }, this);
    }

    #accelerator_label?: Gtk.ShortcutLabel;
    #destroy_id?: number;
    readonly #keybind: string;
    #reset_button?: Gtk.Button;
    #settings?: Gio.Settings;

    get keybind() {
        return this.#keybind;
    }

    constructor(settings: Gio.Settings, keybind: string, params?: Partial<Adw.ActionRow.ConstructorProps>) {
        super(params);

        this.#keybind = keybind;
        this.#settings = settings;
        this.#destroy_id = this.connect('destroy', () => this.destroy());
    }

    destroy(): void {
        if (this.#destroy_id) {
            this.disconnect(this.#destroy_id);
            this.#destroy_id = undefined;
        }

        this.#settings = undefined;
    }

    vfunc_realize() {
        super.vfunc_realize();

        const box = (this.get_child() as Gtk.Box) || null;
        if (!box)
            throw new TypeError("No child available");

        this.#accelerator_label = new Gtk.ShortcutLabel({disabled_text: "Disabled"});
        box.append(this.#accelerator_label);
        this.#reset_button = new Gtk.Button({label: "Reset"});
        box.append(new Gtk.Revealer({child: this.#reset_button, transition_type: Gtk.RevealerTransitionType.SLIDE_RIGHT}));
        this.set_activatable(true);
    }

    vfunc_unrealize() {
        super.vfunc_unrealize();

        this.#accelerator_label = undefined;
        this.#reset_button = undefined;
    }
}
