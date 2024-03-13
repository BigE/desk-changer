import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import Interface from '../../daemon/interface.js';
import DaemonMetaTypeRow from './daemon/meta_type_row.js';
import RotationModes from '../../common/rotation.js';
import { makeProxyWrapper } from '../../common/service.js';
import NewDialog from '../dialog/new.js';
import { debug } from '../../common/logging.js';

const DaemonPage = GObject.registerClass({
	GTypeName: 'DaemonPage',
	InternalChildren: [
		'allowed_mime_types_listbox',
		'allowed_mime_types_reset_button',
		'daemon_auto_start_switch',
		'daemon_remember_profile_state_switch',
		'daemon_running_switch',
		'rotation_custom_interval_spinner',
		'rotation_mode_combo',
	],
	Template: `file:///home/eric/Projects/desk-changer/resources/ui/prefs/daemon.ui`,
},
class DeskChangerPreferencesDaemonPage extends Adw.PreferencesPage {
	vfunc_realize(widget) {
		this._daemon = makeProxyWrapper();
		this._allowed_mime_types_id = null;
		this._rotation_mode_combo_position = 0;

		super.vfunc_realize();
		this._daemon_running_switch.set_active(this._daemon.Running);
		this._rotation_mode_combo.set_model(RotationModes);
		Interface.settings.bind('auto-start', this._daemon_auto_start_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
		Interface.settings.bind('remember-profile-state', this._daemon_remember_profile_state_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
		Interface.settings.bind('interval', this._rotation_custom_interval_spinner, 'value', Gio.SettingsBindFlags.DEFAULT);
		this._daemon_running_id = this._daemon.connectSignal('Running', () => {
			this._daemon_running_switch.set_active(this._daemon.Running);
		});
		this._load_mime_types();
		this._set_rotation_mode_combo_position();

		this._rotation_mode_combo_notify_id = this._rotation_mode_combo.connect('notify::selected-item', () => {
			Interface.settings.rotation = this._rotation_mode_combo.selected_item.key;
		});
	}

	vfunc_unrealize(widget) {
		if (this._allowed_mime_types_id)
			Interface.settings.disconnect(this._allowed_mime_types_id);

		if (this._daemon_running_id)
			this._daemon.disconnectSignal(this._daemon_running_id);

		if (this._rotation_mode_combo_notify_id)
			this._rotation_mode_combo.disconnect(this._rotation_mode_combo_notify_id);

		Interface.settings.unbind(this._daemon_auto_start_switch, 'active');
		Interface.settings.unbind(this._daemon_remember_profile_state_switch, 'active');
		Interface.settings.unbind(this._rotation_custom_interval_spinner, 'value');
		this._daemon = null;
		super.vfunc_unrealize();
	}

	_load_mime_types() {
		const mime_types = Interface.settings.allowed_mime_types;

		if (this._allowed_mime_types_id) {
			Interface.settings.disconnect(this._allowed_mime_types_id);
		}

		if (this._button_add_id) {
			this._button_add.disconnect(this._button_add_id);
		}

		this._allowed_mime_types_listbox.remove_all();

		this._button_add = new Gtk.Button({icon_name: 'list-add-symbolic', css_classes: ['flat']});
		this._button_add_id = this._button_add.connect('clicked', button => this._on_allowed_mime_types_add_button_clicked(button));
		this._allowed_mime_types_listbox.append(this._button_add)
		this._allowed_mime_types_reset_button.set_visible(Interface.settings.get_user_value('allowed-mime-types'));
		mime_types.forEach(mime_type => this._allowed_mime_types_listbox.append(new DaemonMetaTypeRow({title: mime_type})));
		this._allowed_mime_types_id = Interface.settings.connect('changed::allowed-mime-types', () => this._load_mime_types());
	}

	_on_allowed_mime_types_add_button_clicked(button) {
		const dialog = new NewDialog({title: 'New MIME Type'});

		dialog.set_default_size(340, -1);
		dialog.cancel_button.connect('clicked', widget => widget.get_root().close());
		dialog.save_button.connect('clicked', widget => {
			const window = widget.get_root(),
			      mime_type = window.entry.get_text();

			if (mime_type.length > 0) {
				const allowed_mime_types = Interface.settings.allowed_mime_types;

				allowed_mime_types.push(mime_type);
				Interface.settings.allowed_mime_types = allowed_mime_types;
				window.close();
			}
		});
		dialog.set_transient_for(this.get_root());
		dialog.present();
	}

	_on_allowed_mime_types_reset_button_clicked(button) {
		Interface.settings.reset('allowed-mime-types');
	}

	_on_rotation_mode_combo_factory_bind(widget, item) {
		const label = item.get_child(),
		      rotationMode = item.get_item();

		label.set_label(rotationMode.label);

		if (rotationMode.key === String(Interface.settings.rotation)) {
			this._rotation_mode_combo_position = item.get_position();
		}
	}

	_on_rotation_mode_combo_factory_setup(widget, item) {
		const label = new Gtk.Label();

		item.set_child(label);
	}

	_set_rotation_mode_combo_position() {
		this._rotation_mode_combo.set_selected(this._rotation_mode_combo_position);
	}
});

export default DaemonPage;