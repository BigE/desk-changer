import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import {SettingsKeybindType} from '../../../common/settings.js';

export default class KeyboardShortcutRow extends Adw.ActionRow {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPrefsKeyboardShortcutRow',
                Properties: {
                    keybind: GObject.param_spec_string(
                        'keybind',
                        'Keybind',
                        '',
                        null,
                        GObject.ParamFlags.READABLE
                    ),
                },
            },
            this
        );
    }

    #accelerator_label?: Gtk.ShortcutLabel;
    #binding?: GObject.Binding;
    readonly #keybind: string;
    #reset_button?: Gtk.Button;

    get accelerator_label(): Gtk.ShortcutLabel | undefined {
        return this.#accelerator_label;
    }

    get keybind() {
        return this.#keybind;
    }

    constructor(
        keybind: SettingsKeybindType,
        accelerator?: string,
        params?: Partial<Adw.ActionRow.ConstructorProps>
    ) {
        super(params);

        this.#keybind = keybind;
        this.#accelerator_label = new Gtk.ShortcutLabel({
            disabled_text: 'Disabled',
        });
        this.#accelerator_label.accelerator = accelerator || '';
    }

    vfunc_realize() {
        super.vfunc_realize();

        const box = (this.get_child() as Gtk.Box) || null;
        if (!box) throw new TypeError('No child available');
        if (this.#accelerator_label) box.append(this.#accelerator_label);
        this.#reset_button = new Gtk.Button({label: 'Reset'});
        box.append(
            new Gtk.Revealer({
                child: this.#reset_button,
                transition_type: Gtk.RevealerTransitionType.SLIDE_RIGHT,
            })
        );
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
