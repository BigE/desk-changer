import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import {SettingsKeybindType} from "../../../common/settings.js";

export default class KeyboardShortcutRow extends Adw.ActionRow {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsKeyboardShortcutRow",
            Properties: {
                "accelerator": GObject.param_spec_string(
                    "accelerator", "Accelerator",
                    "The Gtk.accelerator_name value for this row",
                    null, GObject.ParamFlags.READWRITE
                ),
                "keybind": GObject.param_spec_string(
                    "keybind", "Keybind",
                    "",
                    null, GObject.ParamFlags.READABLE
                ),
            }
        }, this);
    }

    #accelerator?: string;
    #accelerator_label?: Gtk.ShortcutLabel;
    #binding?: GObject.Binding;
    readonly #keybind: string;
    #reset_button?: Gtk.Button;

    get accelerator(): string | null {
        return this.#accelerator || null;
    }

    get keybind() {
        return this.#keybind;
    }

    set accelerator(accelerator: string | null) {
        this.#accelerator = accelerator || undefined;
        this.notify('accelerator');
    }

    constructor(keybind: SettingsKeybindType, accelerator?: string, params?: Partial<Adw.ActionRow.ConstructorProps>) {
        super(params);

        this.#accelerator = accelerator;
        this.#keybind = keybind;
    }

    vfunc_realize() {
        super.vfunc_realize();

        const box = (this.get_child() as Gtk.Box) || null;
        if (!box)
            throw new TypeError("No child available");

        this.#accelerator_label = new Gtk.ShortcutLabel({disabled_text: "Disabled"});
        this.#binding = this.bind_property('accelerator', this.#accelerator_label, 'accelerator', GObject.BindingFlags.SYNC_CREATE);
        box.append(this.#accelerator_label);
        this.#reset_button = new Gtk.Button({label: "Reset"});
        box.append(new Gtk.Revealer({child: this.#reset_button, transition_type: Gtk.RevealerTransitionType.SLIDE_RIGHT}));
        this.set_activatable(true);
    }

    vfunc_unrealize() {
        if (this.#binding) {
            this.#binding.unbind();
            this.#binding = undefined;
        }

        this.#accelerator_label = undefined;
        this.#reset_button = undefined;

        super.vfunc_unrealize();
    }
}
