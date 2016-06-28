namespace DeskChanger
{
	[DBus (name = "org.gnome.Shell.Extensions.DeskChanger.Daemon")]
	class Daemon : Object
	{
		string[] accepted = {"image/jpeg", "image/png", "application/xml"};

		Settings background = null;

		GenericArray<string> history = null;

		MainLoop loop = null;

		GenericArray<string> queue = null;

		Settings settings = null;

		TimeoutSource timeout = null;

		GenericArray<string> wallpapers = null;

		public string up_next {
			get {
				return queue.get(0);
			}
		}

		private Daemon(Settings _settings)
		{
			background = new Settings("org.gnome.desktop.background");
			settings = _settings;
		}

		public int load_profile()
		{
			int success = -1;
			string profile = settings.get_string("profile");

			info("loading profile %s", profile);
			history = new GenericArray<string>();
			queue = new GenericArray<string>();
			wallpapers = new GenericArray<string>();
			Variant profiles = settings.get_value("profiles");

			return success;
		}

		public static int main(string[] args)
		{
			Daemon daemon = null;
			string settings_path = Path.get_dirname(args[0]) + "/schemas/";
			Settings _settings = null;
			SettingsSchema schema = null;
			SettingsSchemaSource source = null;

			try {
				source = new SettingsSchemaSource.from_directory(settings_path, null, false);
			} catch (IOError e) {
				error("unable to load settings: %s", e.message);
			} catch (Error e) {
				error("unable to load settings: %s", e.message);
			}

			schema = source.lookup("org.gnome.shell.extensions.desk-changer", false);

			if (schema == null) {
				error("settings not found in %s", settings_path);
			}

			_settings = new Settings.full(schema, null, null);
			daemon = new Daemon(_settings);
			daemon.run();
			return 0;
		}

		public string next()
		{
			string wallpaper = null;
			return wallpaper;
		}

		public string prev()
		{
			string wallpaper = null;
			return wallpaper;
		}

		public signal void preview(string wallpaper);

		[DBus (visible = false)]
		public void run()
		{
			Variant profiles = settings.get_value("profiles");
			loop = new MainLoop();
			toggle_timer();
			loop.run();
		}

		private void toggle_timer()
		{
			if (settings.get_boolean("timer-enabled")) {
				if (timeout != null) {
					debug("cleaning up old timer");
					timeout.destroy();
				}
				int interval = settings.get_int("interval");
				timeout = new TimeoutSource.seconds(interval);
				timeout.set_callback(() => {
					next();
					return true;
				});
				timeout.attach(loop.get_context());
				info("automatic timer enabled for %d seconds", interval);
			} else if (timeout != null) {
				info("disabling automatic timer");
				timeout.destroy();
				timeout = null;
			}
		}
	}
}