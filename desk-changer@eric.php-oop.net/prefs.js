/**
 *  ▄▄▄▄    ██▓  ▄████   ▄████  ██▓▓█████
 * ▓█████▄ ▓██▒ ██▒ ▀█▒ ██▒ ▀█▒▓██▒▓█   ▀
 * ▒██▒ ▄██▒██▒▒██░▄▄▄░▒██░▄▄▄░▒██▒▒███
 * ▒██░█▀  ░██░░▓█  ██▓░▓█  ██▓░██░▒▓█  ▄
 * ░▓█  ▀█▓░██░░▒▓███▀▒░▒▓███▀▒░██░░▒████▒
 * ░▒▓███▀▒░▓   ░▒   ▒  ░▒   ▒ ░▓  ░░ ▒░ ░
 * ▒░▒   ░  ▒ ░  ░   ░   ░   ░  ▒ ░ ░ ░  ░
 *  ░    ░  ▒ ░░ ░   ░ ░ ░   ░  ▒ ░   ░
 *  ░       ░        ░       ░  ░     ░  ░
 *       ░
 */

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const DeskChangerSettings = Me.imports.settings.DeskChangerSettings;
const DeskChangerDaemon = Me.imports.daemon.DeskChangerDaemon;

const DeskChangerPrefs = new Lang.Class({
	Name: 'DeskChangerPrefs',

	_init: function ()
	{
		this._daemon = new DeskChangerDaemon();
		this.box = new Gtk.Box({
			border_width: 10,
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 10
		});

		this._settings = new DeskChangerSettings();
		this.notebook = new Gtk.Notebook();
		this._initProfiles();
		this._initDaemon();
		this._initAbout();
		this.box.pack_start(this.notebook, true, true, 0);
		this.box.show_all();
	},

	toggle_subfolders: function(widget, path)
	{
		var iter = this._folders.get_iter_from_string(path)[1];
		this._folders.set_value(iter, 1, !this._folders.get_value(iter, 1));
		var profiles = this._settings.profiles;
		profiles[this.profiles_combo_box.get_active_text()][path][1] = Boolean(this._folders.get_value(iter, 1));
		this._settings.profiles = profiles;
		this._load_profiles();
	},

	_initAbout: function()
	{
		var about_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
		this.notebook.append_page(about_box, new Gtk.Label({label: 'About'}));
	},

	_initDaemon: function ()
	{
		var daemon_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
		var box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
		var label = new Gtk.Label({label: 'DeskChanger Daemon:'});
		box.pack_start(label, false, true, 5);
		label = new Gtk.Label({label: ' '});
		box.pack_start(label, true, true, 5);
		this._switch = new Gtk.Switch();
		this._switch.set_active(this._daemon.is_running);
		this._switch_handler = this._switch.connect('notify::active', Lang.bind(this._daemon, this._daemon.toggle));
		this._daemon.connect('toggled', Lang.bind(this, function(obj, state, pid) {
			if (this._switch_handler) {
				this._switch.disconnect(this._switch_handler);
				this._switch_handler = null;
			}
			debug('toggled('+state+', '+pid+')');
			this._switch.set_active(state);
			this._switch_handler = this._switch.connect('notify::active', Lang.bind(this._daemon, this._daemon.toggle));
		}));
		box.pack_start(this._switch, false, true, 5);
		daemon_box.pack_start(box, true, false, 10);
		this.notebook.append_page(daemon_box, new Gtk.Label({label: 'Daemon'}));
	},

	_initProfiles: function ()
	{
		this._folders = new Gtk.ListStore();
		this._folders.set_column_types([GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]);
		var profiles_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
		var hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
		var label = new Gtk.Label({label: 'Profile'});
		hbox.pack_start(label, false, false, 10);
		profiles_box.pack_start(hbox, false, false, 10);
		this.profiles_combo_box = new Gtk.ComboBoxText();
		this.profiles_combo_box.connect('changed', Lang.bind(this, function(object) {
			for (var profile in this._settings.profiles) {
				if (profile == object.get_active_text()) {
					this._folders.clear();
					for (var folder in this._settings.profiles[profile]) {
						folder = [this._settings.profiles[profile][folder][0], this._settings.profiles[profile][folder][1]];
						this._folders.insert_with_valuesv(-1, [0, 1], folder);
					}
					break;
				}
			}
		}));

		hbox.pack_start(this.profiles_combo_box, true, true, 10);
		this.add_profile = new Gtk.Button({label: 'Add'});
		this.add_profile.set_sensitive(true);
		this.add_profile.connect('clicked', Lang.bind(this, function () {
			var dialog, mbox, box, label, input;
			dialog = new Gtk.Dialog();
			mbox = dialog.get_content_area();
			box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
			label = new Gtk.Label({label: 'Profile Name'});
			box.pack_start(label, false, true, 10);
			input = new Gtk.Entry();
			box.pack_end(input, true, true, 10);
			box.show_all();
			mbox.pack_start(box, true, true, 10);
			dialog.add_button('OK', Gtk.ResponseType.OK);
			dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
			var result = dialog.run();
			if (result == Gtk.ResponseType.OK) {
				var profiles = this._settings.profiles;
				profiles[input.get_text()] = [];
				this._settings.profiles = profiles;
				this._load_profiles();
			}
			dialog.destroy();
		}));
		hbox.pack_start(this.add_profile, false, true, 0);
		this.remove_profile = new Gtk.Button({label: 'Remove'});
		this.remove_profile.connect('clicked', Lang.bind(this, function () {
			var profile, dialog, box, label;
			profile = this.profiles_combo_box.get_active_text();
			dialog = new Gtk.Dialog();
			box = dialog.get_content_area();
			label = new Gtk.Label({label: 'Are you sure you want to delete the profile "'+profile+'"?'});
			box.pack_start(label, true, true, 10);
			box.show_all();
			dialog.add_button('Yes', Gtk.ResponseType.YES);
			dialog.add_button('No', Gtk.ResponseType.NO);
			var response = dialog.run();
			if (response == Gtk.ResponseType.YES) {
				var profiles = this._settings.profiles;
				delete profiles[profile];
				this._settings.profiles = profiles;
				this._load_profiles();
			}
			dialog.destroy();
		}));
		hbox.pack_start(this.remove_profile, false, true, 0);
		profiles_box.pack_start(hbox, false, false, 10);

		this.profiles = new Gtk.TreeView();
		this.profiles.get_selection().set_mode(Gtk.SelectionMode.SINGLE);
		this.profiles.set_model(this._folders);
		var renderer = new Gtk.CellRendererText();
		renderer.set_property('editable', true);
		renderer.connect('edited', Lang.bind(this, function (renderer, path, new_text) {
			var [bool, iter] = this._folders.get_iter_from_string(path);
			this._folders.set_value(iter, 0, new_text);
			this._save_profile();
		}));
		var column = new Gtk.TreeViewColumn({title: 'Path', expand: true});
		column.pack_start(renderer, true);
		column.add_attribute(renderer, 'text', 0);
		this.profiles.append_column(column);

		renderer = new Gtk.CellRendererToggle();
		renderer.connect('toggled', Lang.bind(this, this.toggle_subfolders));
		column = new Gtk.TreeViewColumn({title: 'Sub Folders', expand: false});
		column.pack_start(renderer, false);
		column.add_attribute(renderer, 'active', 1);
		this.profiles.append_column(column);
		this._load_profiles();

		hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
		this.remove = new Gtk.Button({label: 'Remove'});
		this.remove.connect('clicked', Lang.bind(this, function () {
			var [bool, list, iter] = this.profiles.get_selection().get_selected();
			var path = list.get_path(iter);
			list.row_deleted(path);
			var profiles = this._settings.profiles;
			profiles[this.profiles_combo_box.get_active_text()].splice(path.get_indices(), 1);
			this._settings.profiles = profiles;
			this.remove.set_sensitive(false);
		}));
		this.profiles.connect('cursor_changed', Lang.bind(this, function (treeview) {
			this.remove.set_sensitive(true);
		}));
		this.remove.set_sensitive(false);
		hbox.pack_start(this.remove, false, true, 10);
		var label = new Gtk.Label({label: ' '});
		hbox.pack_start(label, true, true, 0);
		this.add = new Gtk.Button({label: 'Add Image'});
		this.add.connect('clicked', Lang.bind(this, function () {
			this._add_item('Add Image', Gtk.FileChooserAction.OPEN);
		}));
		hbox.pack_start(this.add, false, true, 10);
		this.add = new Gtk.Button({label: 'Add Folder'});
		this.add.connect('clicked', Lang.bind(this, function () {
			this._add_item('Add Folder', Gtk.FileChooserAction.SELECT_FOLDER);
		}));
		hbox.pack_start(this.add, false, true, 10);
		profiles_box.pack_end(hbox, true, true, 10);

		profiles_box.pack_start(this.profiles, true, true, 10);
		this.notebook.append_page(profiles_box, new Gtk.Label({label: 'Profiles'}));
	},

	_add_item: function(title, action)
	{
		var dialog, filter_image, response;
		dialog = new Gtk.FileChooserDialog({title: title, action: action});
		if (action != Gtk.FileChooserAction.SELECT_FOLDER) {
			filter_image = new Gtk.FileFilter();
			filter_image.set_name("Image files");
			filter_image.add_mime_type("image/*");
			dialog.add_filter(filter_image);
		}
		dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
		dialog.add_button(Gtk.STOCK_OPEN, Gtk.ResponseType.OK);
		response = dialog.run();
		if (response == Gtk.ResponseType.OK) {
			var path = dialog.get_uri(), profile, profiles = this._settings.profiles;
			profile = this.profiles_combo_box.get_active_text();
			profiles[profile].push([path, false]);
			this._settings.profiles = profiles;
			this._load_profiles();
		}
		dialog.destroy();
	},

	_load_profiles: function()
	{
		var active = this.profiles_combo_box.get_active(), i = 0, text = this.profiles_combo_box.get_active_text();
		this.profiles_combo_box.remove_all();

		for (var profile in this._settings.profiles) {
			this.profiles_combo_box.insert_text(i, profile);
			if (text == profile || (active == -1 && profile == this._settings.current_profile)) {
				active = i;
			}
			i++;
		}

		this.profiles_combo_box.set_active(active);
	},

	_save_profile: function()
	{
		var profile = [];
		this._folders.foreach(Lang.bind(profile, function (model, path, iter) {
			this.push([model.get_value(iter, 0), model.get_value(iter, 1)]);
		}));
		debug(JSON.stringify(profile));
		debug(this.profiles_combo_box.get_active_text());
		var profiles = this._settings.profiles;
		profiles[this.profiles_combo_box.get_active_text()] = profile;
		this._settings.profiles = profiles;
		this.profiles_combo_box.do_changed();
	}
});

function buildPrefsWidget()
{
	var widget = new DeskChangerPrefs();
	return(widget.box);
}

function debug(output)
{
	var date = new Date();
	output = '['+date.toLocaleString()+']'+Me.metadata.uuid+'[PREFS]: '+output;
	log(output);
}

function init()
{
	debug("init");
}
