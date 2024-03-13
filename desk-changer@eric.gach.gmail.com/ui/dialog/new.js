import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Interface from '../../daemon/interface.js';

const NewDialog = GObject.registerClass({
	GTypeName: 'NewDialog',
	InternalChildren: [
		'cancel_button',
		'entry',
		'save_button',
	],
	Template: `file:///home/eric/Projects/desk-changer/resources/ui/dialog/new.ui`,
},
class DeskChangerNewDialog extends Gtk.Window {
	get cancel_button() {
		return this._cancel_button;
	}

	get entry() {
		return this._entry;
	}

	get save_button() {
		return this._save_button;
	}
});

export default NewDialog;