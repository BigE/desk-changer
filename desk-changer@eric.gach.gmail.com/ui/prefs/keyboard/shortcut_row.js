import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import KeybindDialog from '../../dialog/keybind.js';
import Interface from '../../../daemon/interface.js';

const KeyboardShortcutRow = GObject.registerClass({
	GTypeName: 'KeyboardShortcutRow',
	InternalChildren: [
		'accelerator_label',
	],
	Properties: {
		'keybind': GObject.param_spec_string(
			'keybind',
			'Keybind',
			'The DeskChanger specific keybind id that this row manages',
			null,
			GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
		),
	},
	Template: `resource:///org/gnome/Shell/Extensions/DeskChanger/ui/prefs/keyboard/shortcutrow.ui`,
},
class DeskChangerPreferencesKeyboardShortcutRow extends Adw.ActionRow {
	get keybind() {
		if (this._keybind === undefined)
			this._keybind = null;

		return this._keybind;
	}

	constructor(params={keybind: null}) {
		const keybind = params['keybind'];

		delete params['keybind'];

		super(params);

		this._keybind = keybind;
	}

	vfunc_realize() {
		super.vfunc_realize();

		this.set_activatable(true);
		this._activated_id = this.connect('activated', widget => this._on_activated(widget));
		this._settings_id = Interface.settings.connect(`changed::${this.keybind}`, () => this._update_keybind_from_settings());
		this._update_keybind_from_settings();
	}

	vfunc_unrealize() {
		if (this._activated_id) {
			this.disconnect(this._activated_id);
			this._activated_id = null;
		}

		if (this._settings_id) {
			this.disconnect(this._settings_id);
			this._settings_id = null;
		}
	}

	_on_activated(widget) {
		const dialog = new KeybindDialog({
			keybind_id: this.keybind,
			keybind_name: this.get_title(),
			transient_for: this.get_root(),
		});

		dialog.present();
	}

	_update_keybind_from_settings() {
		this._accelerator_label.set_accelerator(Interface.settings.getKeybinding(this.keybind));
	}
});

export default KeyboardShortcutRow;