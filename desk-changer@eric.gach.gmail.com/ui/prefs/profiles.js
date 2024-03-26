import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import DialogAdd from '../dialog/add.js';
import DialogAlert from '../dialog/alert.js';
import Interface from '../../daemon/interface.js';
import { Location } from '../common/profiles.js';
import NewDialog from '../dialog/new.js';

const ProfilesPage = GObject.registerClass({
	GTypeName: 'ProfilesPage',
	InternalChildren: [
		'add_profile_button',
		'combo_row_profiles',
		'factory_row_profiles',
		'locations_listview',
		'locations_selection',
		'remove_item_button',
		'remove_profile_button',
	],
	Template: 'file:///home/eric/Projects/desk-changer/resources/ui/prefs/profiles.ui',
},
class DeskChangerPreferencesProfilesPage extends Adw.PreferencesPage {
	constructor(params={}) {
		let model = null,
			selected = null;

		if ('model' in params) {
			model = params['model'];
			delete params['model'];
		}

		if ('selected' in params) {
			selected = params['selected'];
			delete params['selected'];
		}

		super(params);

		this._dialog_items = null;
		this._combo_row_profiles.set_model(model);
		this._combo_row_profiles.selected = selected;
		this._combo_row_profiles.connect('notify::selected-item', actionRow => this._on_notify_selected_item(actionRow));

		this._locations_selection.set_model(this._combo_row_profiles.selected_item.locations);
	}

	get combo_row_profiles() {
		return this._combo_row_profiles;
	}

	vfunc_realize() {
		this._locations_selection.connect('selection-changed', (model, position, n_items) => {
			this._remove_item_button.set_sensitive(this._locations_selection.get_model().get_n_items() > 1 && position !== -1);
		});

		console.log(this._combo_row_profiles.get_model().get_n_items() > 1);
		this._remove_profile_button.set_sensitive(this._combo_row_profiles.get_model().get_n_items() > 1);

		super.vfunc_realize();
	}

	_on_add_folder_button_clicked() {
		const dialog = new DialogAdd();

		dialog.set_title('Add Folder(s)');
		dialog.select_multiple_folders(this.get_root(), null, this._on_dialog_add_response.bind(this));
		this._dialog_items = false;
	}

	_on_add_item_button_clicked() {
		const dialog = new DialogAdd();

		dialog.set_title('Add Image(s)');
		dialog.open_multiple(this.get_root(), null, this._on_dialog_add_response.bind(this));
		this._dialog_items = true;
	}

	_on_add_profile_button_clicked() {
		const dialog = new NewDialog({title: 'Add Profile'});

		dialog.set_transient_for(this.get_root());
		dialog.cancel_button.connect('clicked', button => dialog.close());
		dialog.save_button.connect('clicked', button => {
			const window = button.get_root(),
			      profile = dialog.entry.get_text();

			if (profile.length > 0) {
				const profiles = Interface.settings.profiles,
				      model = this._combo_row_profiles.get_model();
				profiles[profile] = Array();
				Interface.settings.profiles = profiles;
				window.close();

				for (let i = 0; i < model.get_n_items(); i++) {
					const item = model.get_item(i);

					if (item.name === profile) {
						this._combo_row_profiles.set_selected(i);
						break;
					}
				}
			}
		});
		dialog.present();
	}

	_on_dialog_add_response(dialog, response) {
		const list = (this._dialog_items)? dialog.open_multiple_finish(response) : dialog.select_multiple_folders_finish(response),
				length = list.get_n_items(),
				profile = Interface.settings.current_profile;
		let profiles = Interface.settings.profiles;

		for (let i = 0; i < length; i++) {
			const item = list.get_item(i),
					values = [item.get_uri(), false, true];
		
			profiles[profile].push(values);
			this._locations_selection.get_model().append(new Location({location: item.get_uri(), recursive: false}))
		}

		Interface.settings.profiles = profiles;
		this._dialog_items = null;
	}

	_on_factory_row_profiles_bind(widget, item) {
		const label = item.get_child(),
		      profile = item.get_item();
		
		label.set_label(profile.name);
	}

	_on_factory_row_profiles_setup(widget, item) {
		const label = new Gtk.Label();
		item.set_child(label);
	}

	_on_locations_factory_bind(widget, item) {
		const row = item.get_child(),
		      location = item.get_item();

		row.set_title(location.location);
		row.set_active(location.recursive);
		row.connect('notify::active', (object, pspec) => {
			let profiles = Interface.settings.profiles;
			const index = profiles[this._combo_row_profiles.selected_item.name].findIndex(element => element[0] === object.title);
			
			profiles[this._combo_row_profiles.selected_item.name][index][1] = object.active;
			Interface.settings.profiles = profiles;
		});
	}

	_on_locations_factory_setup(widget, item) {
		const row = new Adw.SwitchRow();

		item.set_child(row);
	}

	_on_notify_selected_item(widget) {
		this._locations_selection.set_model(widget.selected_item.locations);
	}

	_on_remove_item_button_clicked() {
		const dialog = new DialogAlert(),
		      profile = this._combo_row_profiles.get_selected_item(),
		      location = this._locations_selection.get_selected_item();

		dialog.set_message(`Are you sure you want to remove ${location.location} from ${profile.name}?`);
		dialog.choose(this.get_root(), null, (dialog, response) => {
			const result = dialog.choose_finish(response);

			if (result === 0) {
				let profiles = Interface.settings.profiles;

				profiles[profile.name].splice(profiles[profile.name].indexOf([location.location, location.recursive]), 1);
				Interface.settings.profiles = profiles;
				this._locations_selection.get_model().remove(this._locations_selection.get_selected());
				this._remove_item_button.set_sensitive(false);
			}
		});
	}

	_on_remove_profile_button_clicked() {
		const dialog = new DialogAlert();

		dialog.set_message(`Are you sure you want to remove the profile ${this._combo_row_profiles.get_selected_item().name}?`);
		dialog.choose(this.get_root(), null, (dialog, response) => {
			const result = dialog.choose_finish(response);

			if (result === 0) {
				let profiles = Interface.settings.profiles;

				delete profiles[this._combo_row_profiles.get_selected_item().name];
				Interface.settings.profiles = profiles;
			}
		});
	}
});

export default ProfilesPage;
