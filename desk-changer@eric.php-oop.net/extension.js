const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtil.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const DeskChangerButton = new Lang.Class({
	Name: 'DeskChangerButton',
	Extends: St.Button,

	_init: function(icon, callback)
	{
		this.icon = new St.Icon({icon_name: icon+'-symbolic', icon_size: 20});
		this.parent({child: this.icon, style_class: 'notification-icon-button control-button'});
		this.connect('clicked', callback);
	},

	set_icon: function(icon)
	{
		this.icon.icon_name = icon+'-symbolic';
	}
});

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

/**
 * This is the actual indicator that should be added to the main panel.
 *
 * @type {Lang.Class}
 */
const DeskChangerIndicator = new Lang.Class({
	Name: 'DeskChangerIndicator',
	Extends: PanelMenu.Button,

	_init: function ()
	{
		this.settings = new DeskChangerSettings();
		this.parent(0.0, 'DeskChanger');
		this.actor.add_child(new DeskChangerIcon());
		this.menu.addMenuItem(new DeskChangerSwitch('Notifications', 'notifications', this.settings));
	},

	destroy: function ()
	{
		this.parent();
	}
});

/**
 * This is just a helper class to tie into the settings.
 *
 * @type {Lang.Class}
 */
const DeskChangerSettings = new Lang.Class({
	Name: 'DeskChangerSettings',
	Extends: Gio.Settings,
	Properties: {
		'current_profile': GObject.ParamSpec.string(
			'current_profile', '', '', GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE, 'gnome'
		),
		'interval': GObject.ParamSpec.integer(
			'interval', '', '', GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE, 0, 3600, 300
		),
		'notifications': GObject.ParamSpec.boolean(
			'notifications', '', '', GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE, true
		),
		'profiles': GObject.ParamSpec.string(
			'profiles', '', '', GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE, ''
		),
		'timer_enabled': GObject.ParamSpec.boolean(
			'timer_enabled', '', '', GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE, true
		)
	},

	_init: function ()
	{
		var source = Gio.SettingsSchemaSource.new_from_directory(
			Me.dir.get_child('schemas').get_path(),
			Gio.SettingsSchemaSource.get_default(),
			false
		);
		this.parent({settings_schema: source.lookup('org.gnome.shell.extensions.desk-changer', false)});
		this._handlers = [];
	},

	connect: function(signal, callback)
	{
		var handler_id = this.parent(signal, callback);
		this._handlers.push(handler_id);
	},

	destroy: function ()
	{
		// Remove the remaining signals...
		while (this._handlers.length) {
			this.disconnect(this._handlers[0]);
		}

		this.parent();
	},

	disconnect: function (handler_id)
	{
		var index = this._handlers.valueOf(handler_id);
		this.parent(handler_id);

		if (index > -1) {
			this._handlers.splice(index, 1);
		}
	},

	get current_profile()
	{
		return this.get_string('current-profile');
	},

	set current_profile(value)
	{
		this.set_string('current-profile', value);
	},

	get interval()
	{
		return this.get_integer('interval');
	},

	set interval(value)
	{
		this.set_integer('interval', parseInt(value));
	},

	get notifications()
	{
		return this.get_boolean('notifications');
	},

	set notifications(value)
	{
		this.set_boolean('notifications', Boolean(value));
	},

	get profiles()
	{
		return JSON.parse(this.get_string('profiles'));
	},

	set profiles(value)
	{
		this.set_string('profiles', JSON.stringify(value));
	},

	get timer_enabled()
	{
		return this.get_boolean('timer-enabled');
	},

	set timer_enabled(value)
	{
		this.set_boolean('timer-enabled', Boolean(value));
	}
});

const DeskChangerStateButton = new Lang.Class({
	Name: 'DeskChangerStateButton',
	Extends: DeskChangerButton,

	_init: function(states, callback)
	{
		if (states.length < 2) {
			RangeError('You must provide at least two states for the button');
		}

		this._callback = callback;
		this._states = states;
		this._state = 0;
		this.parent(this._states[0].icon, Lang.bind(this, this._clicked));
	},

	set_state: function(state)
	{
		if (state == this._states[this._state].name) {
			// We are alread on that state... dafuq?!
			return;
		}

		for (var i = 0; i < this._states.length; i++) {
			if (this._states[i].name == state) {
				this.set_icon(this._states[i].icon);
				this._state = i;
				break;
			}
		}
	},

	_clicked: function()
	{
		var state = this._state;
		if (++state >= this._states.length)
			state = 0;
		this.set_state(state);
		this._callback(state);
	}
});

const DeskChangerSwitch = new Lang.Class({
	Name: 'DeskChangerSwitch',
	Extends: PopupMenu.PopupSwitchMenuItem,

	_init: function (label, setting, settings)
	{
		this._setting = setting;
		this._settings = settings;
		this.parent(label);
		this.setToggleState(settings.get_boolean(setting));
		this._handler_changed = settings.connect('changed::'+setting, Lang.bind(this, this._changed));
		this._handler_toggled = this.connect('toggled', Lang.bind(this, this._toggled));
	},

	destroy: function ()
	{
		if (this._handler_changed) {
			this._settings.disconnect(this._handler);
		}

		if (this._handler_toggled) {
			this.disconnect(this._handler_toggled);
		}
	},

	_changed: function (settings, key)
	{
		this.setToggledState(settings.get_boolean(key));
	},

	_toggled: function ()
	{
		this._settings.set_boolean(this._setting, this.state);
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