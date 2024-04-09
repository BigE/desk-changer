import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Interface from '../../../daemon/interface.js';
import DialogAlert from '../../dialog/alert.js';

const DaemonMetaTypeRow = GObject.registerClass({
	GTypeName: 'DaemonMetaTypeRow',
	InternalChildren: [
		'delete_button',
	],
	Template: `resource:///org/gnome/Shell/Extensions/DeskChanger/ui/prefs/daemon/meta_type_row.ui`,
},
class DeskChangerPreferencesDaemonMetaTypeRow extends Adw.ActionRow {
	_on_meta_row_delete_button_clicked(button) {
		const mime_type = button.get_parent().get_parent().get_parent().title,
			  dialog = new DialogAlert({message: `Are you sure you want to remove the MIME type ${mime_type}?`});

		dialog.choose(this.get_root(), null, (widget, response) => {
			const result = widget.choose_finish(response);

			if (result === 0) {
				const mime_types = Interface.settings.allowed_mime_types;

				mime_types.splice(mime_types.indexOf(mime_type), 1);
				Interface.settings.allowed_mime_types = mime_types;
			}
		});
	}
});

export default DaemonMetaTypeRow;
