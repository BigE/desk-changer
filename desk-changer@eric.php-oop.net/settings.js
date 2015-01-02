const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const DeskChangerSettings = new Lang.Class({
	Name: 'DeskChangerSettings',


	_init: function ()
	{
		var source = Gio.SettingsSchemaSource.new_from_directory(
			Me.dir.get_child('schemas').get_path(),
			Gio.SettingsSchemaSource.get_default(),
			false
		);

		this.schema = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.desk-changer', false)});
		this._handlers = [];
	},

	get auto_rotate()
	{
		return(this.schema.get_boolean('auto-rotate'));
	},

	set auto_rotate(value)
	{
		this.schema.set_boolean('auto-rotate', Boolean(value));
	},

	get current_profile()
	{
		return this.schema.get_string('current-profile');
	},

	set current_profile(value)
	{
		this.schema.set_string('current-profile', value);
	},

	get interval()
	{
		return this.schema.get_int('interval');
	},

	set interval(value)
	{
		this.schema.set_int('interval', parseInt(value));
	},

	get notifications()
	{
		return this.schema.get_boolean('notifications');
	},

	set notifications(value)
	{
		this.schema.set_boolean('notifications', Boolean(value));
	},

	get profiles()
	{
		return JSON.parse(this.schema.get_string('profiles'));
	},

	set profiles(value)
	{
		this.schema.set_string('profiles', JSON.stringify(value));
	},

	get random()
	{
		return this.schema.get_boolean('random');
	},

	set random(value)
	{
		this.schema.set_boolean('random', Boolean(value));
	},

	get timer_enabled()
	{
		return this.schema.get_boolean('timer-enabled');
	},

	set timer_enabled(value)
	{
		this.schema.set_boolean('timer-enabled', Boolean(value));
	},

	connect: function(signal, callback)
	{
		var handler_id = this.schema.connect(signal, callback);
		this._handlers.push(handler_id);
	},

	destroy: function ()
	{
		// Remove the remaining signals...
		while (this._handlers.length) {
			this.disconnect(this._handlers[0]);
		}
	},

	disconnect: function (handler_id)
	{
		var index = this._handlers.indexOf(handler_id);
		this.schema.disconnect(handler_id);

		if (index > -1) {
			this._handlers.splice(index, 1);
		}
	}
});
