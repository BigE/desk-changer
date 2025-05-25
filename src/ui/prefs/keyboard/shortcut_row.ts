import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk"

import {APP_PATH} from "../../../common/interface.js";

const ShortcutRow = GObject.registerClass(
{
    GTypeName: 'DeskChangerUiPrefsKeyboardShortcutRow',
    InternalChildren: ['accelerator_label'],
    Properties: {
        "keybind": GObject.param_spec_string(
            "keybind", "Keybind",
            "Specific keybinding name for DeskChanger",
            null, GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
        )
    },
    Template: `resource://${APP_PATH}/ui/prefs/keyboard/shortcut_row.ui`,
},
class DeskChangerUiPrefsKeyboardShortcutRow extends Adw.ActionRow {
    accelerator_label: Gtk.ShortcutLabel;
    _keybind?: string;

    get keybind() {
        return this._keybind ?? null;
    }

    set keybind(value) {
        this._keybind = value ?? undefined;
    }

    constructor(keybind?: string) {
        super();

        // @ts-expect-error
        this.accelerator_label = this._accelerator_label;
        this._keybind = keybind;
    }
}
);

export default ShortcutRow;
