const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;
const versionCheck = imports.misc.extensionUtils.versionCheck;

const DeskChangerSettings = Me.imports.settings.DeskChangerSettings;
const DeskChangerVersion = Me.metadata.version;
const GnomeShellVersion = Main.shellDBusService.ShellVersion;

const DeskChangerButton = new Lang.Class({
	Name: 'DeskChangerButton',
	Extends: St.Button,

	_init: function(icon, callback)
	{
		this.icon = new St.Icon({icon_name: icon+'-symbolic', icon_size: 20});
		this.parent({
			child: this.icon,
			style_class: (versionCheck(['3.10'], GnomeShellVersion))? 'system-menu-action' : 'notification-icon-button control-button'
		});
		this.connect('clicked', callback);
	},

	set_icon: function(icon)
	{
		this.icon.icon_name = icon+'-symbolic';
	}
});

const DeskChangerControls = new Lang.Class({
	Name: 'DeskChangerControls',
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function (dbus, settings)
	{
		this._dbus = dbus;
		this._settings = settings;
		this.parent({can_focus: false, reactive: false});

		this._next = new DeskChangerButton('media-skip-forward', Lang.bind(this._dbus, function () {
			this.nextSync(true);
		}));
		this._prev = new DeskChangerButton('media-skip-backward', Lang.bind(this._dbus, function () {
			this.prevSync();
		}));
		this._random = new DeskChangerStateButton([
			{
				icon: 'media-playlist-shuffle',
				name: 'random'
			},
			{
				icon: 'media-playlist-repeat',
				name: 'ordered'
			}
		], Lang.bind(this, this._toggle_random));
		this._random.set_state((this._settings.random)? 'random' : 'ordered');
		this._timer = new DeskChangerStateButton([
			{
				icon: 'media-playback-stop',
				name: 'enable'
			},
			{
				icon: 'media-playback-start',
				name: 'disable'
			}
		], Lang.bind(this, this._toggle_timer));
		this._timer.set_state((this._settings.timer_enabled)? 'enable' : 'disable');

		this._add(this._prev, {expand: true, x_fill: false});
		this._add(this._random, {expand: true, x_fill: false});
		this._add(this._timer, {expand: true, x_fill: false});
		this._add(this._next, {expand: true, x_fill: false});
	},

	_add: function (widget, params)
	{
		if (versionCheck(['3.10'], GnomeShellVersion)) {
			this.actor.add(widget, params);
		} else {
			this.actorAdd(widget, params);
		}
	},

	_toggle_random: function (state)
	{
		debug('setting order to '+state);
		this._settings.random = (state == 'random');
	},

	_toggle_timer: function (state)
	{
		debug(state+'ing timer');
		this._settings.timer_enabled = (state == 'enable');
	}
});

const DeskChangerDBusInterface = <interface name="org.gnome.shell.extensions.desk_changer">
	<method name="next">
		<arg direction="in" name="history" type="b" />
	</method>
	<method name="prev">
	</method>
	<method name="up_next">
		<arg direction="out" name="next_file" type="s" />
	</method>
	<signal name="next_file">
		<arg direction="out" name="file" type="s" />
	</signal>
</interface>;

const DeskChangerDBusProxy = Gio.DBusProxy.makeProxyWrapper(DeskChangerDBusInterface);

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
		this._dbus = new DeskChangerDBusProxy(Gio.DBus.session, 'org.gnome.shell.extensions.desk_changer', '/org/gnome/shell/extensions/desk_changer');
		this.actor.add_child(new DeskChangerIcon());
		this.menu.addMenuItem(new DeskChangerSwitch('Change with Profile', 'auto_rotate', this.settings));
		this.menu.addMenuItem(new DeskChangerSwitch('Notifications', 'notifications', this.settings));
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(new DeskChangerPreview(this._dbus));
		this.menu.addMenuItem(new DeskChangerOpenCurrent());
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(new DeskChangerControls(this._dbus, this.settings));
	},

	destroy: function ()
	{
		this.parent();
	}
});

const DeskChangerOpenCurrent = new Lang.Class({
	Name: 'DeskChangerOpenCurrent',
	Extends: PopupMenu.PopupMenuItem,

	_init: function ()
	{
		this._background = new Gio.Settings({'schema': 'org.gnome.desktop.background'});
		this.parent('Open Current Wallpaper');
		this._activate_id = this.connect('activate', Lang.bind(this, this._activate));
	},

	destroy: function ()
	{
		this.disconnect(this._activate_id);
		this.parent();
	},

	_activate: function()
	{
		debug('opening current wallpaper '+this._background.get_string('picture-uri'));
		Util.spawn(['xdg-open', this._background.get_string('picture-uri')]);
	}
});

const DeskChangerPreview = new Lang.Class({
	Name: 'DeskChangerPreview',
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function (_dbus)
	{
		this._file = null;
		this._dbus = _dbus;
		this.parent({reactive: true});
		this._box = new St.BoxLayout({vertical: true});
		if (versionCheck(['3.10'], GnomeShellVersion)) {
			this.actor.add(this._box, {align: St.Align.MIDDLE, span: -1});
		} else {
			this.actorAdd(this._box, {align: St.Align.MIDDLE, span: -1});
		}
		this._label = new St.Label({text: "Next Wallpaper\n"});
		this._box.add(this._label);
		this._wallpaper = new St.Bin({});
		this._box.add(this._wallpaper);
		this._texture = new Clutter.Texture({
			filter_quality: Clutter.TextureQuality.HIGH,
			keep_aspect_ratio: true,
			width: 220
		});
		this._wallpaper.set_child(this._texture);
		this._next_file_id = this._dbus.connectSignal('next_file', Lang.bind(this, function (emitter, signalName, parameters) {
			var file = parameters[0];
			this.set_wallpaper(file);
		}));
		this._dbus.up_nextRemote(Lang.bind(this, function (result, e) {
			if (result)
				this.set_wallpaper(result[0]);
		}));
		this._activate_id = this.connect('activate', Lang.bind(this, this._clicked));
	},

	destroy: function ()
	{
		if (this._next_file_id) {
			debug('removing dbus next_file handler '+this._next_file_id);
			this._dbus.disconnectSignal(this._next_file_id);
		}

		if (this._activate_id) {
			this.disconnect(this._activate_id);
		}

		this._wallpaper.destroy();
		this._texture.destroy();
		this._label.destroy();
		this._box.destroy();
		this.parent();
	},

	set_wallpaper: function (file)
	{
		this._file = file;
		file = file.replace('file://', '');
		debug('setting preview to '+file);
		if (this._texture.set_from_file(file) === false) {
			debug('ERROR: Failed to set preview of ' + file);
		}
	},

	_clicked: function ()
	{
		if (this._file) {
			debug('opening file '+this._file);
			Util.spawn(['xdg-open', this._file]);
		} else {
			debug('ERROR: no preview currently set');
		}
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
		state = this._states[state].name;
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
		this.setToggleState(settings[setting]);
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
		this.setToggledState(settings[key]);
	},

	_toggled: function ()
	{
		debug('setting '+this._setting+' to '+this.state);
		this._settings[this._setting] = this.state;
	}
});

function debug(output)
{
	var date = new Date();
	output = '['+date.toLocaleString()+']'+Me.metadata.uuid+': '+output;
	log(output);
}

function disable()
{
	debug('disabling extension');
	if (Main.panel.statusArea.deskchanger) {
		Main.panel.statusArea.deskchanger.destroy();
	}
}

function enable()
{
	debug('enabling extension');
	Main.panel.addToStatusArea('deskchanger', new DeskChangerIndicator());
}

function init()
{
	debug('initalizing extension version: '+DeskChangerVersion);
}