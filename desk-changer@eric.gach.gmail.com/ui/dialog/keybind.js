import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import Interface from '../../daemon/interface.js';

const Keybind = GObject.registerClass({},
class DeskChangerKeybind extends GObject.Object {
});

const KeybindDialog = GObject.registerClass({
	GTypeName: 'KeybindDialog',
	InternalChildren: [
		'cancel_button',
		'edit_box',
		'headerbar',
		'set_button',
		'shortcut_accel_label',
		'stack',
		'standard_box',
		'top_info_label',
	],
	Properties: {
		'keybind_id': GObject.param_spec_string(
			'keybind_id',
			'Keybind ID',
			'DeskChanger keybind ID that this dialog is setting',
			null,
			GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
		),
		'keybind_name': GObject.param_spec_string(
			'keybind_name',
			'Keybind Name',
			'DeskChanger keybind name to display',
			null,
			GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
		),
	},
	Template: `resource:///org/gnome/Shell/Extensions/DeskChanger/ui/dialog/keybind.ui`,
},
class DeskChangerKeybindDialog extends Adw.Window {
	get keybind_id() {
		return this._keybind_id;
	}

	get keybind_name() {
		return this._keybind_name;
	}

	constructor(params={keybind_id: null, keybind_name: null}) {
		const keybind_id = params['keybind_id'],
		      keybind_name = params['keybind_name'];

		delete params['keybind_id'];
		delete params['keybind_name'];

		super(params);

		this._keybind_id = keybind_id;
		this._keybind_name = keybind_name;
	}

	vfunc_show() {
		super.vfunc_show();

		this._top_info_label.set_markup(`Enter new shortcut to change <b>${this.keybind_name}</b>`);
		this._keyval = null;
		this._mask = null;
	}

	_is_valid_binding(keyval, keycode, mask) {
		if ((mask === 0 || mask === Gdk.SHIFT_MASK) && keycode != 0) {
			if ((keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z)
				|| (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z)
				|| (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9)
				|| (keyval == Gdk.KEY_space && mask === 0)) {
					return false;
				}
		}

		return true;
	}

	_on_cancel_button_clicked(button) {
		this._cancel_button.set_visible(false);
		this._set_button.set_visible(false);
		this._keyval = null;
		this._mask = null;
		this._stack.set_visible_child(this._edit_box);
	}

	_on_keybind_dialog_key_pressed(widget, keyval, keycode, state) {
		const event = widget.get_current_event(),
		      explicit_modifiers = Gtk.accelerator_get_default_mod_mask() | Gdk.SHIFT_MASK,
			  mask = state & explicit_modifiers;

		if (!event.is_modifier() && mask === 0 && (keyval === Gdk.KEY_BackSpace || keyval === Gdk.KEY_Escape)) {
			if (keyval === Gdk.KEY_BackSpace) {
				Interface.settings.reset(this.keybind_id);
				this.close();
			}

			return Gdk.Event.STOP;
		}

		this._set_custom_keybind(keyval, keycode, mask);
		return Gdk.Event.STOP;
	}

	_on_set_button_clicked(button) {
		Interface.settings.setKeybinding(this.keybind_id, Gtk.accelerator_name(this._keyval, this._mask));
		this.close();
	}

	_set_custom_keybind(keyval, keycode, mask) {
		if (!Gtk.accelerator_valid(keyval, mask) || !this._is_valid_binding(keyval, keycode, mask))
			return;

		console.log(keyval, keycode, mask);
		this._shortcut_accel_label.set_accelerator(Gtk.accelerator_name(keyval, mask));
		this._stack.set_visible_child(this._standard_box);
		this._cancel_button.set_visible(true);
		this._set_button.set_visible(true);
		this._keyval = keyval;
		this._mask = mask;
	}
});

export default KeybindDialog;