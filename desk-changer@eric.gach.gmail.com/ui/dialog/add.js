import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Interface from '../../daemon/interface.js';

const DialogAdd = GObject.registerClass({
	Template: `file:///home/eric/Projects/desk-changer/resources/ui/dialog/add.ui`,
},
class DeskChangerDialogAdd extends Gtk.FileDialog {
	vfunc_constructed() {
		const fileFilter = new Gtk.FileFilter();

		super.vfunc_constructed();
		Interface.settings.allowed_mime_types.forEach(mime_type => fileFilter.add_mime_type(mime_type));
		this.set_default_filter(fileFilter);
	}
});

export default DialogAdd;