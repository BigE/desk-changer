import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import KeyboardShortcutRow from './keyboard/shortcut_row.js';

const KeyMapping = GObject.registerClass({
	Properties: {
		'keyval': GObject.param_spec_uint(
			'keyval',
			'Keyval',
			'Key value returned by signal',
			0,
			GLib.MAXUINT8,
			0,
			GObject.ParamFlags.READWRITE
		),
		'keycode': GObject.param_spec_uint(
			'keycode',
			'Keycode',
			'Key code returned by signal',
			0,
			GLib.MAXUINT8,
			0,
			GObject.ParamFlags.READWRITE
		),
	},
},
class DeskChangerPreferencesKeyMapping extends GObject.Object {
	get keycode() {
		if (this._keycode === undefined)
			this._keycode = 0;

		return this._keycode;
	}

	get keyval() {
		if (this._keyval === undefined)
			this._keyval = 0;

		return this._keyval;
	}

	set keycode(value) {
		if (value === this._keycode) return;

		this._keycode = Number.parseInt(value);
		this.notify('keycode');
	}

	set keyval(value) {
		if (value === this._keyval) return;

		this._keyval = Number.parseInt(value);
		this._notify('keyval');
	}
});

const KeyboardMapping = GObject.registerClass({
	GTypeName: 'KeyboardMapping',
	Properties: {
		'action': GObject.param_spec_string(
			'action',
			'Action',
			'Action performed when key mapping is activated',
			null,
			GObject.ParamFlags.READWRITE
		),
		'mapping': GObject.param_spec_object(
			'mapping',
			'Mapping',
			'Key mapping to perform the action indicated',
			KeyMapping,
			GObject.ParamFlags.READWRITE
		),
	},
},
class DeskChangerPreferencesKeyboardMapping extends GObject.Object {
	get action() {
		if (this._action === undefined)
			this._action = null;

		return this._action;
	}

	get mapping() {
		if (this._mapping === undefined)
			this._mapping = null;

		return this._mapping;
	}

	set action(value) {
		if (value === this._action) return;

		this._action = String(value);
		this.notify('action');
	}

	set mapping(value) {
		if (value === this._mapping) return;

		this._mapping = value;
		this.notify('mapping');
	}
});

const KeyboardPage = GObject.registerClass({
	GTypeName: 'KeyboardPage',
	InternalChildren: [
		'keymap_listbox',
	],
	Template: `resource:///org/gnome/Shell/Extensions/DeskChanger/ui/prefs/keyboard/page.ui`,
},
class DeskChangerPreferencesKeyboardPage extends Adw.PreferencesPage {
	constructor(params={}) {
		super(params);

		this._keymap_listbox.append(new KeyboardShortcutRow({title: 'Next Wallpaper', keybind: 'next-wallpaper'}));
		this._keymap_listbox.append(new KeyboardShortcutRow({title: 'Previous Wallpaper', keybind: 'prev-wallpaper'}));
	}
});

export default KeyboardPage;