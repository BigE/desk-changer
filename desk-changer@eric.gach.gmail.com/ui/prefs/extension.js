import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Interface from '../../daemon/interface.js';

const ExtensionPage = GObject.registerClass({
	GTypeName: 'ExtensionPage',
	InternalChildren: [
		'current_profile_combo',
		'icon_preview_switch',
		'notifications_switch',
	],
	Template: `resource:///org/gnome/Shell/Extensions/DeskChanger/ui/prefs/extension.ui`,
},
class DeskChangerPreferencesExtensionPage extends Adw.PreferencesPage {
	constructor(params={}) {
		let model = null,
			selected = null;

		if ('model' in params) {
			model = params['model'];
			delete params['model'];
		} else {
			throw new Error('model is required');
		}

		if ('selected' in params) {
			selected = params['selected'];
			delete params['selected'];
		}

		super(params);

		this._current_profile_combo.set_model(model);

		if (selected)
			this._current_profile_combo.set_selected(selected);

		Interface.settings.bind('icon-preview', this._icon_preview_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
		Interface.settings.bind('notifications', this._notifications_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
		
		this._selected_changed_id = this._current_profile_combo.connect('notify::selected', (object, _pspec) => {
			Interface.settings.current_profile = object.get_selected_item().name;
		});
	}

	destroy() {
		Interface.settings.unbind(this._icon_preview_switch, 'active')
		Interface.settings.unbind(this._notifications_switch, 'active');

		if (this._selected_changed_id)
			this._current_profile_combo.disconnect(this._selected_changed_id);

		super.destroy();
	}

	_on_current_profile_combo_factory_bind(wigdet, item) {
		const label = item.get_child(),
		      profile = item.get_item();

		console.log(label);
		label.set_label(profile.name);
	}

	_on_current_profile_combo_factory_setup(widget, item) {
		const label = new Gtk.Label();

		console.log(label);
		item.set_child(label);
	}
});

export default ExtensionPage;