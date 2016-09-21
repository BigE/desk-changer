namespace DeskChanger
{
	[DBus (name = "org.gnome.Shell.Extensions.DeskChanger.Daemon")]
	class Daemon : Object
	{
		/**
		 * These are the accepted MIME types.
		 */
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

		public bool load_profile(string profileName)
		{
			bool success = false;

			info("loading profile %s", profileName);
			history = new GenericArray<string>();
			queue = new GenericArray<string>();
			wallpapers = new GenericArray<string>();
			Variant profiles = settings.get_value("profiles");
			Variant profile = profiles.lookup_value(profileName, VariantType.ARRAY);

			// Profile was found, load it.
			if (profile != null) {
				debug("profile %s was found - loading files", profileName);
				string path = null;
				bool recursive = false;
				VariantIter iter = profile.iterator();
				while (iter.next("(sb)", &path, &recursive)) {
					string message = null;
					File location = null;
					debug("finding all files in %s %s", path, (recursive)? "recursively" : "");

					try {
						location = File.new_for_uri(path);
					} catch (Error e) {
						message = e.message;
					}

					if (location != null) {
						_load_location(location, recursive, true);
					} else {
						critical("Unable to load URL %s: %s", path, message);
					}
				}

				if (wallpapers.length == 0) {
					critical("No wallpapers loaded for profile %s", profileName);
				} else {
					success = true;
					if (wallpapers.length < 100) {
						warning("you have less than 100 wallpapers available, disabling strict random checking");
					}

					info("profile %s loaded with %d wallpapers", profileName, wallpapers.length);
				}
			}

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
			if (!load_profile(settings.get_string("current-profile"))) {
				error("failed to load the current profile");
			}

			loop = new MainLoop();
			toggle_timer();
			loop.run();
		}

		private void _load_children(File location, bool recursive)
		{
			FileEnumerator enumerator = null;

			try {
				enumerator = location.enumerate_children("standard::*", FileQueryInfoFlags.NONE, null);
			} catch (Error e) {
				critical("failed to load %s: %s", location.get_uri(), e.message);
			}

			FileInfo info = null;

			do {
				string message = null;

				try {
					info = enumerator.next_file(null);
				} catch (Error e) {
					message = e.message;
				}

				if (info != null) {
					File child = location.resolve_relative_path(info.get_name());
					if (child != null) {
						_load_location(child, recursive, false);
					} else {
						critical("failed to load children for %s", info.get_name());
					}
				}
			} while(info != null);
		}

		private void _load_location(File location, bool recursive, bool topLevel)
		{
			FileInfo info = null;
			string message = "no error";

			try {
				info = location.query_info("standard::*", FileQueryInfoFlags.NONE, null);
			} catch (Error e) {
				message = e.message;
			}

			if (info == null) {
				critical("failed to load %s: %s", location.get_uri(), message);
				return;
			}

			string content_type = info.get_content_type();

			if ((recursive || topLevel) && info.get_file_type() == FileType.DIRECTORY) {
				// TODO: LIES! all lies. we watch nothing. yet.
				debug("watching %s for changes", location.get_uri());
				_load_children(location, recursive);
			} else if (info.get_file_type() == FileType.REGULAR && content_type in accepted) {
				debug("adding wallpaper %s", location.get_uri());
				wallpapers.add(location.get_uri());
			}
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