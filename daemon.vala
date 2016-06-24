namespace DeskChanger
{
    [DBus (name = "org.gnome.Shell.Extensions.DeskChanger.Daemon")]
    class Daemon : Object
    {
        string[] accepted = {"image/jpeg", "image/png", "application/xml"};
        Settings background = null;
        GenericArray<string> history = null;
        MainLoop loop = null;
        uint name_id;
        Json.Parser profiles = null;
        uint position = 0;
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
            profiles = new Json.Parser();
            background = new Settings("org.gnome.desktop.background");
            settings = _settings;
            // initalize and load the current profile
            _load_profiles();
            // connect the callbacks
            settings.changed["current-profile"].connect(() => {
                load_profile(settings.get_string("current-profile"));
                if (settings.get_boolean("auto-rotate")) {
                    _next(false);
                }
            });
            settings.changed["interval"].connect(_toggle_timer);
            settings.changed["profiles"].connect(_load_profiles);
            settings.changed["random"].connect(() => {
                string mode;
                if (settings.get_boolean("random")) {
                    mode = "random";
                } else {
                    mode = "ordered";
                }
                debug("wallpapers now showing in %s mode", mode);
                _next(true);
            });
            settings.changed["timer-enabled"].connect(_toggle_timer);
            name_id = Bus.own_name (BusType.SESSION,
                                    "org.gnome.Shell.Extensions.DeskChanger.Daemon",
                                    BusNameOwnerFlags.ALLOW_REPLACEMENT
                                    | BusNameOwnerFlags.REPLACE,
                                    _on_bus_acquired, () => {load_profile(settings.get_string("current-profile"));}, quit);
        }

        ~Daemon()
        {
            Bus.unown_name(name_id);
        }

        public signal void changed(string wallpaper_uri);

        public void load_profile(string profile)
        {
            unowned Json.Array _profile = null;
            history = new GenericArray<string>();
            queue = new GenericArray<string>();
            position = 0;
            wallpapers = new GenericArray<string>();

            info("loading profile %s", profile);
            try {
                var root = profiles.get_root().get_object();
                _profile = root.get_member(profile).get_array();
            } catch (Error e) {
                warning("failed to load profile %s", profile);
            }

            foreach (Json.Node element_node in _profile.get_elements()) {
                Json.Array item = element_node.get_array();
                debug("loading item %s", item.get_string_element(0));
                File location = File.new_for_uri(item.get_string_element(0));
                _load_location(location, item.get_boolean_element(1), true);
            }

            info("profile %s loaded with %u wallpapers", profile, wallpapers.length);
            if (wallpapers.length < 100) {
                warning("you have less than 100 wallpapers avaialable, disabling stricter random checking");
            }
            wallpapers.sort(GLib.strcmp);
            _load_next();
            if (settings.get_boolean("auto-rotate")) {
                _next(false);
            }
        }

        public static int main(string[] args)
        {
            Daemon daemon = null;
            string settings_path = Path.get_dirname(args[0]) + "/schemas/";
            SettingsSchemaSource source = null;
            SettingsSchema schema = null;
            Settings settings = null;

            try {
                source = new SettingsSchemaSource.from_directory(settings_path, null, false);
            } catch (IOError e) {
                error("settings not found: %s", e.message);
            } catch (Error e) {
                error("settings not found: %s", e.message);
            }

            schema = source.lookup("org.gnome.shell.extensions.desk-changer", false);

            if (schema == null) {
                error("settings not found in %s", settings_path);
            }

            settings = new Settings.full(schema, null, null);
            daemon = new Daemon(settings);
            daemon.run();
            return 0;
        }

        public string next()
        {
            string wallpaper;
            wallpaper = _next(true);
            return wallpaper;
        }

        public signal void preview(string wallpaper_uri);

        public string prev()
        {
            string wallpaper = "";

            if (history.length == 0) {
                warning("no available history");
            } else {
                string current = background.get_string("picture-uri");
                queue.add(current);
                wallpaper = history.get(0);
                history.remove_index(0);
                _background(wallpaper);
            }

            return wallpaper;
        }

        public void quit()
        {
            loop.quit();
        }

        [DBus (visible = false)]
        public void run()
        {
            loop = new MainLoop();
            _toggle_timer();
            loop.run();
        }

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
            //while ((info = enumerator.next_file(null)) != null) {
                try {
                    info = enumerator.next_file(null);
                } catch (Error e) {
                    critical("failed to load sub-item of %s: %s", location.get_uri(), e.message);
                }
                File child = location.resolve_relative_path(info.get_name());
                _load_location(child, recursive, false);
            } while(info != null);
        }

        private void _load_location(File location, bool recursive, bool topLevel)
        {
            FileInfo info = null;
            try {
                info = location.query_info("standard::*", FileQueryInfoFlags.NONE, null);
            } catch (Error e) {
                critical("failed to load %s: %s", location.get_uri(), e.message);
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

        private void _load_profiles()
        {
            try {
                profiles.load_from_data((string) settings.get_string("profiles"), -1);
            } catch (Error e) {
                error("failed reading profiles from settings: %s", e.message);
            }
        }

        private string _next(bool _history)
        {
            string wallpaper = "";
            if (wallpapers.length == 0) {
                critical("no available wallpapers are loaded");
            } else {
                if (_history) {
                    debug("adding %s to the history", background.get_string("picture-uri"));
                    history.insert(history.length, background.get_string("picture-uri"));
                    while (history.length > 100) {
                        debug("[GC] removing %s from history", history.get(history.length - 1));
                        history.remove_index(history.length - 1);
                    }
                }

                _load_next();
                wallpaper = queue.get(0);
                queue.remove_index(0);
                _background(wallpaper);
            }

            return wallpaper;
        }

        private void _on_bus_acquired(DBusConnection conn)
        {
            try {
                conn.register_object ("/org/gnome/Shell/Extensions/DeskChanger/Daemon", this);
                info("registered DBus name");
            } catch (IOError e) {
                error ("Could not register D-Bus service: %s", e.message);
            }
        }

        private void _toggle_timer()
        {
            if (settings.get_boolean("timer-enabled")) {
                if (timeout != null) {
                    debug("cleaning up old timer");
                    timeout.destroy();
                }
                timeout = new TimeoutSource.seconds(settings.get_int("interval"));
                timeout.set_callback(() => {
                    next();
                    return true;
                });
                timeout.attach(loop.get_context());
                info("enabled automatic timer for %d seconds", settings.get_int("interval"));
            } else if (timeout != null) {
                info("disabling automatic timer");
                timeout.destroy();
                timeout = null;
            }
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