const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtil.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;

const DeskChangerIcon = new Lang.Class({
	Name: 'DeskChangerIcon',
	Extends: St.BoxLayout,

	_init: function()
	{
		this.parent({style_class: 'panel-status-menu-box'});
		this.add_child(new St.Icon({
			icon_name: 'emblem-photos-symbolic',
			style_class: 'system-status-icon'
		}));
	}
});

const DeskChangerIndicator = new Lang.Class({
	Name: 'DeskChangerIndicator',
	Extends: PanelMenu.Button,

	_init: function ()
	{
		this.settings = new DeskChangerSettings();
		this.parent(0.0, 'DeskChanger');
		this.actor.add_child(new DeskChangerIcon());
	}
});

const DeskChangerSettings = new Lang.Class({
	Name: 'DeskChangerSettings',
	Extends: Gio.Settings,

	_init: function ()
	{
		var source = Gio.SettingsSchemaSource.new_from_directory(
			Me.dir.get_child('schemas').get_path(),
			Gio.SettingsSchemaSource.get_default(),
			false
		);
		this.parent({settings_schema: source.lookup('org.gnome.shell.extensions.desk-changer', false)});
	},

	get interval()
	{
		return this.get_integer('interval');
	},

	set interval(value)
	{
		this.set_integer('interval', parseInt(value));
	}
});

function disable()
{
	if (Main.panel.statusArea.deskchanger) {
		Main.panel.statusArea.destroy();
	}
}

function enable()
{
	Main.panel.addToStatusArea('deskchanger', new DeskChangerIndicator());
}

function init()
{
}