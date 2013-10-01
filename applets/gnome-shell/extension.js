const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = Me.imports.util;

const DeskChangerInterface = <interface name="org.gnome.DeskChanger">
	<method name="Next">
		<arg direction="in" name="history" type="b" />
		<arg direction="out" name="next_file" type="s" />
	</method>
	<method name="Prev">
		<arg direction="out" name="next_file" type="s" />
	</method>
	<method name="PreviewNext">
		<arg direction="out" name="file" type="s" />
	</method>
	<signal name="NextFile">
		<arg direction="out" name="file" type="s" />
	</signal>
</interface>;
const DeskChangerProxy = Gio.DBusProxy.makeProxyWrapper(DeskChangerInterface);

const DeskChangerStatusIcon = new Lang.Class({
	Name: 'DeskChangerStatusIcon',
	Extends: St.BoxLayout,

	_init: function ()
	{
		this.parent({style_class: 'panel-status-menu-box'});
		this.add_child(new St.Icon({icon_name: 'emblem-photos-symbolic', style_class: 'system-status-icon'}));
		this.add_child(new St.Label({text: '\u25BE', y_expand: true, y_align: Clutter.ActorAlign.CENTER}));
	}
});

const DeskChangerButton = new Lang.Class({
	Name: 'DeskChangerButton',
	Extends: St.Button,

	_init: function (icon, callback)
	{
		this.icon = new St.Icon({icon_name: icon+'-symbolic', icon_size: 20});
		this.parent({child: this.icon, style_class: 'system-menu-action'});
		this.connect('clicked', callback);
	},

	set_icon: function (icon)
	{
		this.icon.icon_name = icon+'-symbolic';
	}
});

const DeskChangerStateButton = new Lang.Class({
	Name: 'DeskChangerStateButton',
	Extends: DeskChangerButton,

	_init: function (states, callback)
	{
		if (states.length < 2) {
			RangeError('you must have at least two states for the button');
		}

		this._callback = callback;
		this._states = states;
		this._state = 0;

		this.parent(this._states[0].icon+'-symbolic', Lang.bind(this, this._clicked));
	},

	set_state: function (state)
	{
		if (state == this._states[this._state].name) {
			// already that state
			return;
		}

		for (let i = 0; i < this._states.length; i++) {
			if (this._states[i].name == state) {
				Util.debug('setting state to '+this._states[i].icon);
				this.set_icon(this._states[i].icon);
				this._state = i;
			}
		}
	},

	_clicked: function ()
	{
		var state = this._state;
		if (++state >= this._states.length)
			state = 0;
		this.set_state(state);
	}
});

const DeskChangerControls = new Lang.Class({
	Name: 'DeskChangerControls',
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function (dbus)
	{
		this._dbus = dbus
		this.parent({reactive: false});
		this._box = new St.BoxLayout({vertical: false});
		this.actor.add(this._box, {align: St.Align.MIDDLE, span: -1});
		this._prev = new DeskChangerButton('media-skip-backward', Lang.bind(dbus, function () {
			this.PrevSync();
		}));
		this._box.add(this._prev);
		this._random = new DeskChangerStateButton([
			{
				icon: 'media-playlist-shuffle',
				name: 'random'
			},
			{
				icon: 'media-playlist-repeat',
				name: 'ordered'
			}
		], Lang.bind(this, this._random_toggled));
		this._random.set_state((true)? 'random' : 'ordered');
		this._box.add(this._random);

		this._interval = new DeskChangerStateButton([
			{
				icon: 'media-playback-start',
				name: 'timer-disabled'
			},
			{
				icon: 'media-playback-stop',
				name: 'timer-enabled'
			}
		], Lang.bind(this, this._timer_toggled));
		this._interval.set_state('timer-'+((true)? 'enabled' : 'disabled'));
		this._box.add(this._interval);
		this._next = new DeskChangerButton('media-skip-forward', Lang.bind(dbus, function () {
			this.NextSync(true);
		}));
		this._box.add(this._next);
	},

	_random_toggled: function ()
	{
    },

	_timer_toggled: function ()
	{
    }
});

const DeskChangerPreview = new Lang.Class({
	Name: 'DeskChangerPreview',
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function ()
	{
		this.parent({reactive: false});
		this._box = new St.BoxLayout({vertical: true});
		this.actor.add(this._box, {align: St.Align.MIDDLE, span: -1});
		this._label = new St.Label({text: "Wallpaper up Next\n"});
		this._box.add(this._label);
		this._wallpaper = new St.Bin({});
		this._box.add(this._wallpaper);
		this._texture = new Clutter.Texture({
			filter_quality: Clutter.TextureQuality.HIGH,
			keep_aspect_ratio: true,
			width: 220
		});
		this._wallpaper.set_child(this._texture);
	},

	destroy: function ()
	{
		this._wallpaper.destroy();
		this._texture.destroy();
		this._label.destroy();
		this._box.destroy();
		this.parent();
	},

	set_wallpaper: function (file)
	{
		file = file.replace('file://', '');
		Util.debug('setting preview from file '+file);
		if (this._texture.set_from_file(file) === false) {
			Util.error('FAILED setting preview of '+file);
		}
	}
});

const DeskChangerIndicator = new Lang.Class({
	Name: 'DeskChangerIndicator',
	Extends: PanelMenu.Button,

	_init: function ()
	{
		this.parent(0.0, 'DeskChanger');
        this.settings = new DeskChangerExtensionSettings();
		this.actor.add_child(new DeskChangerStatusIcon());
		this._dbus = new DeskChangerProxy(Gio.DBus.session, 'org.gnome.DeskChanger', '/org/gnome/DeskChanger');
        this._bus_watch_id = Gio.bus_watch_name(Gio.BusType.SESSION, 'org.gnome.DeskChanger', Gio.BusNameWatcherFlags.NONE, Lang.bind(this, function () {
            this._dbus.active = true
        }), Lang.bind(this, function () {
            this._dbus.active = false
        }));
		Util.debug('connected to dbus org.gnome.DeskChanger');
		this._next_file_id = this._dbus.connectSignal('NextFile', Lang.bind(this, this._next_file));
		this._preview = new DeskChangerPreview();
        this._switch = new DeskChangerSwitch('Change Lockscreen', 'change-lock-screen', this.settings);
        this.menu.addMenuItem(this._switch);
        this.menu.addMenuItem(new DeskChangerSwitch('Lock Disables Timer', 'lock-disables-timer', this.settings));
        this.menu.addMenuItem(new DeskChangerSwitch('Show Notifications', 'notifications', this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(this._preview);
		this._dbus.PreviewNextRemote(Lang.bind(this, function (result, excp) {
            if (result)
		        this._preview.set_wallpaper(result[0]);
        }));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(new DeskChangerControls(this._dbus));
	},

	destroy: function ()
	{
		if (this._next_file_id) {
			Util.debug('removing signal handler: '+this._next_file_id);
			this._dbus.disconnectSignal(this._next_file_id);
		}
        Gio.bus_unwatch_name(this._bus_watch_id);
		this.parent();
	},

	_next_file: function (emitter, senderName, parameters)
	{
		[file] = parameters;
		Util.debug('caught signal NextFile('+file+')');
		this._preview.set_wallpaper(file);
	}
});

const DeskChangerExtensionSettings = new Lang.Class({
    Name: 'DeskChangerExtensionSettings',

    _init: function ()
    {
        var source = Gio.SettingsSchemaSource.new_from_directory(
            Me.dir.get_child('schemas').get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
        this.schema = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.desk-changer', false)});
    },

    get change_lock_screen()
    {
        return this.schema.get_boolean('change-lock-screen');
    },

    set change_lock_screen(value)
    {
        this.schema.set_boolean(Boolean(value))
    },

    get lock_disables_timer()
    {
        return this.schema.get_boolean('lock-disables-timer');
    },

    set lock_disables_timer(value)
    {
        this.schema.set_boolean('lock-disables-timer', Boolean(value))
    },

    get notifications()
    {
        return this.schema.get_boolean('notifications');
    },

    set notifications(value)
    {
        this.schema.set_boolean('notifications', Boolean(value))
    }
});

const DeskChangerSwitch = new Lang.Class({
    Name: 'DeskChangerSwitch',
    Extends: PopupMenu.PopupSwitchMenuItem,

    _init: function (text, setting, settings)
    {
        this.settings = settings;
        this.parent(text);
        this.setting = setting;
        this.setToggleState(settings.schema.get_boolean(setting));
        this._setting_handler = settings.schema.connect('changed::'+setting, Lang.bind(this, function (settings, key) {
            Util.debug('updating switch for '+key);
            this.setToggleState(settings.get_boolean(key));
        }));
        this._toggled_handler = this.connect('toggled', Lang.bind(this, function () {
            Util.debug('setting '+this.setting+' to '+this.state);
            this.settings.schema.set_boolean(this.setting, this.state);
        }));
    },

    destroy: function ()
    {
        this.settings.schema.disconnect(this._setting_handler);
        this.disconnect(this._toggled_handler);
        this.parent();
    }
});

function disable()
{
	Util.debug('disabling extension...');
	if (Main.panel.statusArea.deskchanger)
		Main.panel.statusArea.deskchanger.destroy();
	Util.debug('extension disabled');
}

function enable()
{
	Util.debug('enabling extension...');
	Main.panel.addToStatusArea('deskchanger', new DeskChangerIndicator());
	Util.debug('extension enabled!')
}

function init()
{
	Util.debug('initializing extension');
}
