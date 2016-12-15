#!/usr/bin/env python

import os.path
import random
import sys
from gi import require_version
from gi.repository import GLib, Gio, GObject
from gi._gi import variant_type_from_string

require_version('Gio', '2.0')

__daemon_path__ = os.path.abspath(os.curdir)
__version__ = '2.0.1'

DeskChangerDaemonDBusInterface = Gio.DBusNodeInfo.new_for_xml('''<node>
    <interface name="org.gnome.Shell.Extensions.DeskChanger.Daemon">
        <method name="LoadProfile">
            <arg direction="in" name="profile" type="s" />
        </method>
        <method name="Next">
            <arg direction="out" name="uri" type="s" />
        </method>
        <method name="Prev">
            <arg direction="out" name="uri" type="s" />
        </method>
        <method name="Quit"></method>
        <signal name="changed">
            <arg direction="out" name="uri" type="s" />
        </signal>
        <signal name="preview">
            <arg direction="out" name="uri" type="s" />
        </signal>
        <property type="as" name="history" access="read" />
        <property type="as" name="queue" access="read" />
    </interface>
</node>''')


class DeskChangerDaemon(Gio.Application):
    def __init__(self, **kwargs):
        super(DeskChangerDaemon, self).__init__(**kwargs)
        self.add_main_option('--version', ord('v'), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
                             'Show the current daemon version and exit', None)
        # We use this as our DBus interface name also
        self.set_application_id('org.gnome.Shell.Extensions.DeskChanger.Daemon')
        self.set_flags(Gio.ApplicationFlags.IS_SERVICE | Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        # Load the settings
        settings_path = os.path.abspath(os.path.join(os.curdir, 'schemas'))

        try:
            source = Gio.SettingsSchemaSource.new_from_directory(settings_path, None, False)
            # TODO - standardize this name with the DBus name, namespacing the daemon/extension settings
            schema = source.lookup('org.gnome.shell.extensions.desk-changer', False)
        except GLib.Error as e:
            self._warning('Failed to open directory %s to load settings', settings_path)
            self._warning('GLib.Error: %s', e)
            schema = None

        if schema is None:
            self._error('Failed to load settings from %s', settings_path)

        self._settings = Gio.Settings.new_full(schema, None, None)
        self._settings_signals = []
        self._background = Gio.Settings.new('org.gnome.desktop.background')
        # internal stuffs
        self._accepted = ['application/xml', 'image/jpeg', 'image/png']
        self._dbus_id = None
        self._history = []
        self._monitors = []
        self._position = 0
        self._queue = []
        self._timer = None
        self._wallpapers = []

    def do_activate(self):
        self._debug('::activate')
        self._toggle_timer()
        # since we're a service, increase the hold count to stay running
        self.hold()

    def do_dbus_register(self, connection, object_path):
        """Register the application on the DBus, if this fails, the application cannot run

        :param connection: The DBus connection for the application
        :param object_path: The object path
        :type connection: Gio.DBusConnection
        :type object_path: str
        :return: True if successful, False if not
        :rtype: bool
        """
        self._debug('::dbus_register')
        Gio.Application.do_dbus_register(self, connection, object_path)
        try:
            self._dbus_id = connection.register_object(
                object_path,
                DeskChangerDaemonDBusInterface.interfaces[0],
                self._handle_dbus_call,
                None,
                None
            )
        except GLib.Error as e:
            self._debug(e.args)
        finally:
            if self._dbus_id is None or self._dbus_id == 0:
                self._critical('failed to register DBus name %s', object_path)
                return False

        self._log(GLib.LogLevelFlags.LEVEL_INFO, 'successfully registered DBus name %s', object_path)
        return True

    def do_dbus_unregister(self, connection, object_path):
        """Remove the application from the DBus, this happens after shutdown

        :param connection:
        :param object_path:
        :type connection: Gio.DBusConnection
        :type object_path: str
        """
        self._debug('::dbus_unregister')
        Gio.Application.do_dbus_unregister(self, connection, object_path)
        if self._dbus_id:
            self._log(GLib.LogLevelFlags.LEVEL_INFO, 'removing DBus registration for name %s', object_path)
            connection.unregister_object(self._dbus_id)
            self.release()

    def do_handle_local_options(self, options):
        o = options.end().unpack()
        if '--version' in o and o['--version']:
            print('%s: %s' % (__file__, __version__))
            return 0
        return Gio.Application.do_handle_local_options(self, options)

    def do_startup(self):
        """Startup method of application, get everything setup and ready to run here"""
        self._debug('::startup')
        Gio.Application.do_startup(self)
        action = Gio.SimpleAction.new('quit', None)
        action.connect('activate', self.quit)
        self.add_action(action)
        # Load the current profile
        self.load_profile(self._settings.get_string('current-profile'))
        # Connect the settings signals
        self._connect_settings_signal('changed::timer-enabled', lambda s, k: self._toggle_timer())
        self._connect_settings_signal('changed::current-profile',
                                      lambda s, k: self.load_profile(s.get_string('current-profile')))
        self._connect_settings_signal('changed::random', lambda s, k: self._toggle_random())
        # just because we're a service... activate is not called. can someone actually help me understand this?
        # https://git.gnome.org/browse/glib/tree/gio/gapplication.c?h=2.50.0#n1023
        self.activate()

    def do_shutdown(self):
        """Shutdown method of application, cleanup here"""
        self._debug('::shutdown')
        for signal_id in self._settings_signals:
            self._debug('disconnecting signal handler %d', signal_id)
            self._settings.disconnect(signal_id)
        Gio.Application.do_shutdown(self)

    def load_profile(self, profile):
        """Load the specified profile into the daemon, if the profile fails to load, a ValueError will be thrown

        :param profile: profile to be loaded
        """
        self._info('loading profile %s', profile)
        profile_items = self._settings.get_value('profiles').unpack().get(profile)
        if profile_items is None:
            self._critical('failed to load profile %s because it doesn\'t exist', profile)
            raise ValueError('failed to load profile %s' % (profile,))

        for monitor in self._monitors:
            monitor.cancel()
        # reset the values, we're loading a new profile now
        self._history = []
        self._monitors = []
        self._position = 0
        self._queue = []
        self._wallpapers = []

        for (uri, recursive) in profile_items:
            self._debug('loading %s for profile %s%s', uri, profile, ' recursively' if recursive else '')
            try:
                location = Gio.File.new_for_uri(uri)
                self._load_profile_location(location, recursive, True)
            except GLib.Error as e:
                self._warning('failed to load %s for profile %s: %s', uri, profile, str(e.args))

        if len(self._wallpapers) == 0:
            self._critical('no wallpapers were loaded for profile %s - wallpaper will not change', profile)
            raise ValueError('no wallpapers were loaded for profile %s', profile)
        else:
            if len(self._wallpapers) < 100:
                self._warning('available total wallpapers is under 100 (%d) - strict random checking is disabled',
                              len(self._wallpapers))
            self._wallpapers.sort()
            self._load_next()
            self._emit_signal('preview', self._queue[0])
            self._info('profile %s has been loaded with %d wallpapers', profile, len(self._wallpapers))
            if self._settings.get_boolean('auto-rotate') and len(self._wallpapers) > 0:
                self._next(False)

    def next(self):
        """Switch to the next wallpaper, if there aren't any available, a ValueError will be raised

        :return: wallpaper
        :rtype: str
        """
        return self._next()

    def prev(self):
        """Switch to the previous wallpaper, if it is not available, a ValueError will be raised

        :return: wallpaper
        :rtype: str
        """
        if len(self._history) > 0:
            wallpaper = self._history.pop()
            self._queue.insert(0, self._background.get_string('picture-uri'))
            self._background.set_string('picture-uri', wallpaper)
            self._emit_signal('changed', wallpaper)
            self._emit_signal('preview', self._queue[0])
            return wallpaper

        raise ValueError('no history is available, cannot go back further')

    def _connect_settings_signal(self, signal, callback):
        self._settings_signals.append(self._settings.connect(signal, callback))
        self._debug('connected settings signal handler to %s', signal)

    def _critical(self, message, *args):
        self._log(GLib.LogLevelFlags.LEVEL_CRITICAL, message, *args)

    def _debug(self, message, *args):
        self._log(GLib.LogLevelFlags.LEVEL_DEBUG, message, *args)

    def _emit_signal(self, signal, *args):
        retval = GLib.VariantBuilder(variant_type_from_string('r'))
        for arg in args:
            retval.add_value(GLib.Variant.new_string(arg))

        self._debug('[DBUS] emitting signal %s.%s(%s)', self.get_application_id(), signal, str(args))
        self.get_dbus_connection().emit_signal(
            None,
            self.get_dbus_object_path(),
            self.get_application_id(),
            signal,
            retval.end()
        )

    def _error(self, message, *args):
        self._log(GLib.LogLevelFlags.LEVEL_ERROR, message, *args)

    def _files_changed(self, monitor, _file, other_file, event_type):
        self._debug('file monitor %s changed with event type %s', _file.get_uri(), event_type)
        if event_type == Gio.FileMonitorEvent.CREATED and _file.get_file_type() in self._accepted:
            try:
                self._wallpapers.index(_file.get_uri())
            except ValueError:
                self._debug('adding new wallpaper %s', _file.get_uri())
                self._wallpapers.append(_file.get_uri())
                self._wallpapers.sort()
        elif event_type == Gio.FileMonitorEvent.DELETED:
            try:
                i = self._wallpapers.index(_file.get_uri())
                self._debug('removing deleted file %s from the list', _file.get_uri())
                self._wallpapers.pop(i)
                self._wallpapers.sort()
            except ValueError:
                pass

    def _handle_dbus_call(self, connection, sender, object_path, interface_name, method_name, parameters, invocation):
        self._debug('[DBUS] %s:%s', interface_name, method_name)
        if interface_name == 'org.freedesktop.DBus.Properties':
            if method_name == 'GetAll':
                values = {
                    'history': GLib.Variant('as', self._history),
                    'queue': GLib.Variant('as', self._queue),
                }
                invocation.return_value(GLib.Variant('(a{sv})', (values,)))
            elif method_name == 'Get':
                interface_name, property_name = parameters.unpack()
                if property_name == 'history':
                    invocation.return_value(GLib.Variant('(as)', (self._history,)))
                elif property_name == 'queue':
                    invocation.return_value(GLib.Variant('(as)', (self._queue,)))
                else:
                    invocation.return_dbus_error('org.freedesktop.DBus.Error.InvalidArgs',
                                                 'Unknown property %s for interface %s' % (
                                                     property_name, interface_name))
                    self._warning('[DBUS] Unkown propety %s for interface %s', property_name, interface_name)
            else:
                self._warning('Missed call from %s for method %s', interface_name, method_name)
            return
        elif interface_name != self.get_application_id():
            self._warning('received invalid dbus request for interface %s', interface_name)
            return

        if method_name == 'Quit':
            invocation.return_value(None)
            self.quit()
        elif method_name == 'LoadProfile':
            profile, = parameters.unpack()
            try:
                self.load_profile(profile)
                invocation.return_value(None)
            except ValueError as e:
                invocation.return_dbus_error(self.get_application_id() + '.LoadProfile', str(e.args))
        elif method_name == 'Next':
            try:
                invocation.return_value(GLib.Variant('(s)', (self.next(),)))
            except Exception as e:
                invocation.return_dbus_error(self.get_application_id() + '.Next', str(e.args))
        elif method_name == 'Prev':
            try:
                invocation.return_value(GLib.Variant('(s)', (self.prev(),)))
            except ValueError as e:
                invocation.return_dbus_error(self.get_application_id() + '.Prev', str(e.args))
        else:
            self._info('[DBUS] Method %s in %s does not exist', method_name, interface_name)
            invocation.return_dbus_error('org.freedesktop.DBus.Error.UnknownMethod',
                                         'Method %s in %s does not exist' % (method_name, interface_name))
        return

    def _info(self, message, *args):
        self._log(GLib.LogLevelFlags.LEVEL_INFO, message, *args)

    def _load_next(self):
        if len(self._queue) > 1:
            self._debug('there are already %d wallpapers in the queue, skipping', len(self._queue))
            return

        wallpaper = None
        if self._settings.get_boolean('random'):
            while wallpaper is None:
                wallpaper = self._wallpapers[random.randint(0, len(self._wallpapers))]
                self._debug("got %s as a possible next wallpaper", wallpaper);
                if len(self._wallpapers) > 100:
                    if self._history.count(wallpaper) > 0:
                        self._debug("%s has already been shown recently, choosing another wallpaper", wallpaper)
                        wallpaper = None
                    elif self._queue.count(wallpaper) > 0:
                        self._debug("%s is already in the queue, choosing another wallpaper", wallpaper)
                        wallpaper = None
                elif (len(self._history) > 0 and wallpaper == self._history[0]) or (
                                len(self._queue) > 0 and wallpaper == self._queue[0]):
                    self._warning("%s is too similar, grabbing a different one", wallpaper)
                    wallpaper = None
        else:
            if self._position >= len(self._wallpapers):
                self._debug('reached end of wallpapers, resetting counter')
                self._position = 0
            wallpaper = self._wallpapers[self._position]

        self._queue.append(wallpaper)
        self._info('adding %s to the queue', wallpaper)

    def _load_profile_children(self, location, recursive):
        try:
            enumerator = location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None)
        except GLib.Error as e:
            self._warning('failed to load children for location %s: %s', location.get_uri(), str(e.args))
            return

        for info in enumerator:
            child = location.resolve_relative_path(info.get_name())
            if child is None:
                self._critical('failed to load %s', info.get_name())
                continue
            self._load_profile_location(child, recursive)

    def _load_profile_location(self, location, recursive, toplevel=False):
        try:
            info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, None)
        except GLib.Error as e:
            self._warning('failed to load location %s: %s', location.get_uri(), str(e.args))
            return

        if info.get_file_type() == Gio.FileType.DIRECTORY:
            if recursive or toplevel:
                monitor = location.monitor_directory(Gio.FileMonitorFlags.NONE, Gio.Cancellable())
                self._debug('adding %s as directory to watch', location.get_uri())
                monitor.connect('changed', self._files_changed)
                self._monitors.append(monitor)
                self._debug('descending into %s to find wallpapers', location.get_uri())
                self._load_profile_children(location, recursive)
        elif info.get_file_type() == Gio.FileType.REGULAR and info.get_content_type() in self._accepted:
            self._debug('adding wallpaper %s', location.get_uri())
            self._wallpapers.append(location.get_uri())

    def _log(self, level, message, *args):
        message = str(message) % args
        fields = GLib.Variant('a{sv}', {
            "MESSAGE": GLib.Variant('s', message),
        })

        # Because this is fairly new to PyGObject... we have to check if it exists
        # See: https://bugzilla.gnome.org/show_bug.cgi?id=770971
        if hasattr(GLib, 'log_variant'):
            GLib.log_variant(None, level, fields)
        else:
            # TODO - add something here to replace the above
            pass

    def _next(self, append_history=True):
        if len(self._wallpapers) == 0:
            self._critical('no wallpapers are currently available')
            raise ValueError('no wallpapers currently available')

        wallpaper = self._queue.pop(0)
        if append_history:
            self._history.append(self._background.get_string('picture-uri'))
        self._background.set_string('picture-uri', wallpaper)
        self._emit_signal('changed', wallpaper)
        if self._settings.get_boolean('random') is False:
            self._position += 1
        self._load_next()
        self._emit_signal('preview', self._queue[0])
        return wallpaper

    def _toggle_random(self):
        self._debug('clearing queue since randomness was toggled')
        self._queue = []
        self._load_next()
        self._emit_signal('preview', self._queue[0])

    def _toggle_timer(self):
        if self._settings.get_boolean('timer-enabled'):
            if self._timer is not None:
                self._debug('removing old timer')
                GLib.source_remove(self._timer)
            self._timer = GLib.timeout_add_seconds(300, self._timeout)
            self._info('automatic timer enabled for 300 seconds')
        elif self._settings.get_boolean('timer-enabled') is False and self._timer is not None:
            GLib.source_remove(self._timer)
            self._timer = None
            self._info('removed automatic timer')

    def _timeout(self):
        try:
            self._next(True)
        except ValueError:
            pass
        return True

    def _warning(self, message, *args):
        self._log(GLib.LogLevelFlags.LEVEL_WARNING, message, *args)


if __name__ == '__main__':
    daemon = DeskChangerDaemon()
    daemon.run(sys.argv)
