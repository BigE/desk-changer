import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

const DialogAlert = GObject.registerClass({
	Template: `resource:///org/gnome/Shell/Extensions/DeskChanger/ui/dialog/alert.ui`,
},
class DeskChangerDialogAlert extends Gtk.AlertDialog {
	vfunc_constructed() {
		super.vfunc_constructed();

		this.set_buttons(['OK', 'Cancel']);
		this.set_default_button(0);
		this.set_cancel_button(1);
	}
}
);

export default DialogAlert;