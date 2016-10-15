namespace DeskChanger
{
	[DBus (name = "org.gnome.Shell.Extensions.DeskChanger.Daemon")]
	class Daemon : Application
	{
		/**
		 * These are the accepted MIME types.
		 */
		string[] accepted = {"image/jpeg", "image/png", "application/xml"};

		Settings background = null;

		GenericArray<string> history = null;

		MainLoop loop = null;

		GenericArray<FileMonitor> monitors = null;

		uint name_id;

		Variant profile = null;

		uint position;

		GenericArray<string> queue = null;

		Settings settings = null;

		TimeoutSource timeout = null;

		GenericArray<string> wallpapers = null;

		/**
		 * DBUS property to pull the next wallpaper
		 */
		[DBus (name = "queue")]
		public string[] dbus_queue {
			get {
				return queue.data;
			}
		}

		[DBus (name = "history")]
		public string[] dbus_history {
			get {
				return history.data;
			}
		}

		private Daemon(Settings _settings)
		{
			Object(application_id: "org.gnome.Shell.Extensions.DeskChanger.Daemon", flags: ApplicationFlags.IS_SERVICE);

			background = new Settings("org.gnome.desktop.background");
			settings = _settings;

			settings.changed["current-profile"].connect(() => {
				load_profile(settings.get_string("current-profile"));
				if (settings.get_boolean("auto-rotate")) {
					_next(false);
				}
			});

			// TODO: optimize this - should only load the profile if the profile changed
			settings.changed["profiles"].connect(() => {
				load_profile(settings.get_string("current-profile"));
			});

			settings.changed["random"].connect(() => {
				string mode;
				if (settings.get_boolean("random")) {
					mode = "random";
				} else {
					mode = "ordered";
				}

				debug("showing wallpapers in %s mode", mode);
				_next(true);
			});
		}

		~Daemon()
		{
			release();
		}

		public override void activate()
		{
			info("activated");
		}

		public override bool dbus_register(DBusConnection connection, string object_path) throws Error
		{
			base.dbus_register(connection, object_path);

			name_id = connection.register_object(object_path, this);

			if (name_id == 0) {
				return false;
			}

			info("registered DBus name %s", object_path);
			return true;
		}

		public override void dbus_unregister(DBusConnection connection, string object_path)
		{
			connection.unregister_object(name_id);
			base.dbus_unregister(connection, object_path);
		}

		public signal void changed(string wallpaper);

		public bool load_profile(string profileName)
		{
			bool success = false;

			if (monitors != null) {
				debug("cleaning up old file monitors");
				monitors.foreach((monitor) => {
					monitor.cancel();
				});
			}

			info("loading profile %s", profileName);
			monitors = new GenericArray<FileMonitor>();
			history = new GenericArray<string>();
			queue = new GenericArray<string>();
			wallpapers = new GenericArray<string>();
			Variant profiles = settings.get_value("profiles");
			profile = profiles.lookup_value(profileName, VariantType.ARRAY);

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
					wallpapers.sort(GLib.strcmp);
					_load_next();
					success = true;
					if (wallpapers.length < 100) {
						warning("you have less than 100 wallpapers available, disabling strict random checking");
					}

					if (settings.get_boolean("auto-rotate") == true) {
						_next(false);
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
			string wallpaper = "";
			wallpaper = _next(true);
			return wallpaper;
		}

		public string prev()
		{
			string wallpaper = "";

			if (history.length > 0) {
				int index = history.length - 1;
				string current = background.get_string("picture-uri");
				queue.insert(0, current);
				debug("added %s back to queue", current);
				wallpaper = history[index];
				history.remove_index(index);
				_background(wallpaper);
			} else {
				warning("no history available");
			}

			return wallpaper;
		}

		public override void startup()
		{
			base.startup();
			load_profile(settings.get_string("current-profile"));
			hold();

			Timeout.add_seconds_full(Priority.LOW, settings.get_int("interval"), () => {
				if (settings.get_boolean("timer-enabled")) {
					next();
				}

				return true;
			});
		}

		public signal void preview(string wallpaper);

		private void _background(string uri)
		{
			debug("setting %s as background", uri);
			background.set_string("picture-uri", uri);
			debug("emitting signal Changed(%s)", uri);
			changed(uri);
			debug("emitting signal Preview(%s)", queue.get(0));
			preview(queue.get(0));
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
			FileInfo location_info = null;
			string message = "no error";

			try {
				location_info = location.query_info("standard::*", FileQueryInfoFlags.NONE, null);
			} catch (Error e) {
				message = e.message;
			}

			if (location_info == null) {
				critical("failed to load %s: %s", location.get_uri(), message);
				return;
			}

			string content_type = location_info.get_content_type();

			if (location_info.get_file_type() == FileType.DIRECTORY) {
				try {
					FileMonitor monitor = location.monitor_directory(FileMonitorFlags.NONE, new Cancellable());
					debug("watching %s for changes", location.get_uri());
					monitor.changed.connect((file, other_file, event_type) => {
						debug("file monitor %s changed with %s", file.get_uri(), event_type.to_string());
						if (event_type == FileMonitorEvent.CREATED) {
							_load_location(file, recursive, false);
						} else if (event_type == FileMonitorEvent.DELETED) {
							debug("attempting to remove %s", file.get_uri());
							for (int i = 0; i < wallpapers.length; i++) {
								if (strcmp(file.get_uri(), wallpapers.get(i)) == 0) {
									wallpapers.remove_index(i);
									history.remove(file.get_uri());

									if (queue.remove(file.get_uri())) {
										// In case we remove our queue...
										_load_next();
									}

									info("purged deleted file %s", file.get_uri());
									break;
								}
							}
						}
					});
					monitors.add(monitor);
				} catch (IOError e) {
					critical("failed to setup watch for %s: %s", location.get_uri(), e.message);
				}

				if (topLevel || recursive) {
					debug("descending into %s", location.get_uri());
					_load_children(location, recursive);
				}
			} else if (location_info.get_file_type() == FileType.REGULAR && content_type in accepted) {
				debug("adding wallpaper %s", location.get_uri());
				wallpapers.add(location.get_uri());
			}
		}

		private void _load_next()
		{
			if (queue.length > 1) {
				debug("%d wallpapers already in queue, skipping", (int)queue.length);
				return;
			}

			if (settings.get_boolean("random")) {
				string wallpaper = "";
				while (wallpaper.length == 0) {
					wallpaper = wallpapers.get(Random.int_range(0, (int)wallpapers.length - 1));
					debug("got %s as a possible next wallpaper", wallpaper);
					if (wallpapers.length > 100) {
						if (_wallpaper_search(wallpaper, history) != -1) {
							debug("%s has already been shown recently, choosing another wallpaper", wallpaper);
							wallpaper = "";
						} else if (_wallpaper_search(wallpaper, queue) != -1) {
							debug("%s is already in the queue, choosing another wallpaper", wallpaper);
							wallpaper = "";
						}
					} else if ((history.length > 0 && wallpaper == history.get(0)) || (queue.length > 0 && wallpaper == queue.get(0))) {
						warning("%s is too similar, grabbing a different one", wallpaper);
						wallpaper = "";
					}
				}
				info("adding %s to the wallpaper queue", wallpaper);
				queue.add(wallpaper);
			} else {
				if (position >= wallpapers.length) {
					debug("reached end of sequential wallpaper list, restarting");
					position = 0;
				}
				queue.add(wallpapers.get(position));
				position++;
			}
		}

		private string _next(bool enable_history)
		{
			string wallpaper = "";

			if (wallpapers.length > 0) {
				if (enable_history) {
					history.add(background.get_string("picture-uri"));
					debug("added %s to the history", background.get_string("picture-uri"));
					while (history.length > 100) {
						debug("[GC] removing %s from the history", history[0]);
						history.remove_index(0);
					}
				}

				_load_next();
				wallpaper = queue.get(0);
				queue.remove_index(0);
				_background(wallpaper);
			} else {
				critical("no wallpapers loaded");
			}

			return wallpaper;
		}

		private int _wallpaper_search(string needle, GenericArray<string> haystack)
		{
			int result = -1;
			for (int i = 0; i < haystack.length; i++) {
				if (needle == haystack.get(i)) return i;
			}
			return result;
		}
	}
}