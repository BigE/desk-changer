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

const Gdk = imports.gi.Gdk;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Signals = imports.signals;
const St = imports.gi.St;

const DeskChangerPrefs = new Lang.Class({
	Name: 'DeskChangerPrefs',

	_init: function ()
	{
		this.box = new Gtk.Box({
			border_width: 10,
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 10
		});

		this._settings = new Settings.DeskChangerSettings();
		this.notebook = new Gtk.Notebook();
		this._initProfiles();
		this.box.pack_start(this.notebook, true, true, 0);
		this.box.show_all();
	},

	toggle_subfolders: function(widget, path)
	{
		var iter = this._folders.get_iter_from_string(path)[1];
		this._folders.set_value(iter, 1, !this._folders.get_value(iter, 1));
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
						folder = [this._settings.profiles[profile][folder][0].replace('file://', ''), this._settings.profiles[profile][folder][1]];
						this._folders.insert_with_valuesv(-1, [0, 1], folder);
					}
				}
			}
		}));

		hbox.pack_start(this.profiles_combo_box, true, true, 10);
		profiles_box.pack_start(hbox, false, false, 10);

		this.profiles = new Gtk.TreeView();
		this.profiles.connect('cursor_changed', Lang.bind(this, function (treeview) {
			this.remove.set_sensitive(true);
		}));
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

		var active = 0, i = 0;
		for (var profile in this._settings.profiles) {
			this.profiles_combo_box.append_text(profile);
			if (profile == this._settings.current_profile) {
				active = i;
			}
			i++;
		}
		this.profiles_combo_box.set_active(active);

		hbox = new Gtk.ButtonBox({orientation: Gtk.Orientation.HORIZONTAL});
		this.add = new Gtk.Button({label: 'Add Profile'});
		this.add.set_sensitive(true);
		hbox.pack_start(this.add, true, true, 10);
		this.remove = new Gtk.Button({label: 'Remove'});
		this.remove.set_sensitive(false);
		hbox.pack_end(this.remove, false, false, 10);
		profiles_box.pack_end(hbox, true, true, 10);

		profiles_box.pack_start(this.profiles, true, true, 10);
		this.notebook.append_page(profiles_box, new Gtk.Label({label: 'Profiles'}));
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
		this._initProfiles();
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
