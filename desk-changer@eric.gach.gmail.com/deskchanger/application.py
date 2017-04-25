from gi import require_version
from gi.repository import GLib, Gio, GObject
from gi._gi import variant_type_from_string
from . import logger
from .timer import HourlyTimer, IntervalTimer
from .wallpapers import LockscreenProfile, Profile

require_version('Gio', '2.0')
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
        <signal name="error">
            <arg direction="out" name="message" type="s" />
        </signal>
        <signal name="preview">
            <arg direction="out" name="uri" type="s" />
        </signal>
        <property type="as" name="history" access="read" />
        <property type="b" name="lockscreen" access="write" />
        <property type="as" name="queue" access="read" />
    </interface>
</node>''')


class Daemon(Gio.Application):
    __version__ = '2.3.0'

    def __init__(self, **kwargs):
        Gio.Application.__init__(self, **kwargs)
        self.add_main_option('version', ord('v'), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
                             'Show the current daemon version and exit', None)
        # We use this as our DBus interface name also
        self.set_application_id('org.gnome.Shell.Extensions.DeskChanger.Daemon')
        self.set_flags(Gio.ApplicationFlags.IS_SERVICE | Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        self._dbus_id = None
        # lockscreen mode
        self._lockscreen = False
        # setup the settings keys we need
        self._background = Gio.Settings.new('org.gnome.desktop.background')
        self._screensaver = Gio.Settings.new('org.gnome.desktop.screensaver')
        self._settings = Gio.Settings.new('org.gnome.shell.extensions.desk-changer')
        self._settings_handlers = []
        # Setup the profiles
        self._desktop_profile = None
        """:type: Profile"""
        self._desktop_profile_handler = None
        self._lockscreen_profile = None
        """:type: LockscreenProfile"""
        self._lockscreen_profile_handler = None
        # now finally, the timer
        self._timer = None

    def __repr__(self):
        return 'Daemon(lockscreen=%s)' % (self._lockscreen,)

    def change(self, reverse=False):
        func = 'prev' if reverse else 'next'
        update_lockscreen = self._settings.get_boolean('update-lockscreen')
        current = self._background.get_string('picture-uri')
        wallpaper = getattr(self._desktop_profile, func)(current)
        if wallpaper is False:
            return False
        # only update the lock screen if the lock screen profile is not a thing
        if update_lockscreen and self._lockscreen_profile is None:
            self._screensaver.set_string('picture-uri', wallpaper)
        self._background.set_string('picture-uri', wallpaper)
        # now check if the lock screen profile is a thing and we should update
        if self._lockscreen_profile is not None and update_lockscreen:
            current = self._screensaver.get_string('picture-uri')
            _wallpaper = getattr(self._lockscreen_profile, func)(current)
            self._screensaver.set_string('picture-uri', _wallpaper)
            # only change the wallpaper returned if we're in lock screen mode
            if self._lockscreen:
                wallpaper = _wallpaper
        self._emit_changed(wallpaper)
        return wallpaper

    def do_activate(self):
        logger.debug('::activate')
        # load the profiles here, since we're officially active
        self._desktop_profile.load()
        if self._lockscreen_profile:
            self._lockscreen_profile.load()
        # now check auto-rotate, since this didn't get done on load
        if self._settings.get_boolean('auto-rotate'):
            self._desktop_profile.next()
            if self._lockscreen_profile:
                self._lockscreen_profile.next()
        # heart and soul of the daemon, rotate them images!
        self._toggle_timer(self._settings.get_string('rotation'))
        # Since we're a service, we have to increase the hold count to stay running
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
        logger.debug('::dbus_register')
        Gio.Application.do_dbus_register(self, connection, object_path)
        failure = False
        try:
            self._dbus_id = connection.register_object(
                object_path,
                DeskChangerDaemonDBusInterface.interfaces[0],
                self._handle_dbus_call,
                self._handle_dbus_get,
                self._handle_dbus_set
            )
        except TypeError:
            # TODO - Handle this failure correctly.
            failure = True
        except GLib.Error as e:
            logger.debug(e.args)
        finally:
            if self._dbus_id is None or self._dbus_id == 0:
                logger.critical('failed to register DBus name %s', object_path)
                if failure:
                    logger.error('possibly unsupported version of glib')
                return False

        logger.info('successfully registered DBus name %s', object_path)
        return True

    def do_dbus_unregister(self, connection, object_path):
        """Remove the application from the DBus, this happens after shutdown

        :param connection:
        :param object_path:
        :type connection: Gio.DBusConnection
        :type object_path: str
        """
        logger.debug('::dbus_unregister')
        Gio.Application.do_dbus_unregister(self, connection, object_path)
        if self._dbus_id is not None:
            logger.info('removing DBus registration for name %s', object_path)
            connection.unregister_object(self._dbus_id)
            self._dbus_id = None

    def do_handle_local_options(self, options):
        o = options.end().unpack()
        if 'version' in o and o['version']:
            print('%s: %s' % (__file__, Daemon.__version__))
            return 0
        return Gio.Application.do_handle_local_options(self, options)

    def do_startup(self):
        """Startup method of application, get everything setup and ready to run here"""
        logger.debug('::startup')
        Gio.Application.do_startup(self)
        action = Gio.SimpleAction.new('quit', None)
        action.connect('activate', self.quit)
        self.add_action(action)
        # Initialize the current profiles, but do not auto load
        try:
            self.load_profile(self._settings.get_string('current-profile'), False, False)
            if self._settings.get_string('lockscreen-profile') != "":
                self.load_profile(self._settings.get_string('lockscreen-profile'), True, False)
        except ValueError as e:
            # If we failed to load the profile, its bad
            logger.error('failed to load profiles on startup: %s', e.message)
        # Connect the settings signals
        self._settings_handlers.append(self._settings.connect(
            'changed::rotation',
            lambda s, k: self._toggle_timer(self._settings.get_string('rotation'))
        ))
        self._settings_handlers.append(self._settings.connect(
            'changed::interval',
            lambda s, k: self._toggle_timer(self._settings.get_string('rotation'))
        ))
        self._settings_handlers.append(self._settings.connect('changed::current-profile', self._callback_desktop))
        self._settings_handlers.append(self._settings.connect('changed::lockscreen-profile', self._callback_lockscreen))
        self._settings_handlers.append(self._settings.connect('changed::update-lockscreen', self._callback_lockscreen))
        # just because we're a service... activate is not called. can someone actually help me understand this?
        # https://git.gnome.org/browse/glib/tree/gio/gapplication.c?h=2.50.0#n1023
        self.activate()

    def do_shutdown(self):
        logger.debug('::shutdown')
        # save state
        if self._settings.get_boolean('remember-profile-state'):
            self._desktop_profile.save_state(self._background.get_string('picture-uri'))
            if self._lockscreen_profile is not None:
                self._lockscreen_profile.save_state(self._screensaver.set_string('picture-uri'))
        # disconnect signals
        for handler_id in self._settings_handlers:
            self._settings.disconnect(handler_id)
        del self._desktop_profile
        del self._lockscreen_profile
        if self._timer:
            del self._timer
        self.release()
        Gio.Application.do_shutdown(self)

    @GObject.Property(type=GObject.TYPE_STRV)
    def history(self):
        if self._lockscreen and self._lockscreen_profile:
            return self._lockscreen_profile.history
        else:
            return self._desktop_profile.history

    def load_profile(self, name, lock_screen=False, auto_load=True):
        prop = '_desktop_profile' if lock_screen is False else '_lockscreen_profile'
        handler = prop + '_handler'
        background = getattr(self, '_background' if lock_screen is False else '_screensaver')
        if getattr(self, prop) is not None:
            getattr(self, prop).disconnect(getattr(self, handler))
            setattr(self, handler, None)
            if self._settings.get_boolean('remember-profile-state'):
                getattr(self, prop).save_state(background.get_string('picture-uri'))
            getattr(self, prop).release()
            setattr(self, prop, None)
        try:
            if lock_screen is False:
                setattr(self, prop, Profile(name, self._settings, auto_load))
            else:
                setattr(self, prop, LockscreenProfile(name, self._settings, auto_load))
            setattr(self, handler, getattr(self, prop).connect('preview', self._handle_preview))
        except ValueError as e:
            logger.critical('failed to load profile %s', name)
            self._emit_error(str(e))
            raise e

    @GObject.Property(type=GObject.TYPE_STRV)
    def queue(self):
        if self._lockscreen and self._lockscreen_profile:
            return self._lockscreen_profile.queue
        else:
            return self._desktop_profile.queue

    def _callback_desktop(self, obj, key):
        name = self._settings.get_string('current-profile')
        self.load_profile(name)
        if self._settings.get_boolean('auto-rotate'):
            wallpaper = self._desktop_profile.next()
            self._background.set_string('picture-uri', wallpaper)
            if self._settings.get_boolean('update-lockscreen') and self._lockscreen_profile is None:
                self._screensaver.set_string('picture-uri', wallpaper)
            if not self._lockscreen or (self._lockscreen and self._lockscreen_profile is None):
                self._emit_changed(wallpaper)

    def _callback_lockscreen(self, obj, key):
        name = self._settings.get_string('lockscreen-profile')
        if (len(name) == 0 or not self._settings.get_boolean('update-lockscreen')) and self._lockscreen_profile:
            # updating of the lock screen is disabled or inherited, release the Kraken!
            self._lockscreen_profile.disconnect(self._lockscreen_profile_handler)
            self._lockscreen_profile_handler = None
            self._lockscreen_profile.release()
            self._lockscreen_profile = None
        if self._settings.get_boolean('update-lockscreen'):
            if len(name) == 0 or name == self._desktop_profile.name:
                # We only load a lock screen profile if its not inherited from the desktop profile
                logger.info('not loading lock screen profile since its inheriting from the desktop')
                wallpaper = self._background.get_string('picture-uri')
            else:
                self.load_profile(name, True)
                wallpaper = self._lockscreen_profile.next()
            if wallpaper and self._settings.get_boolean('auto-rotate'):
                self._screensaver.set_string('picture-uri', wallpaper)
                if self._lockscreen:
                    self._emit_changed(wallpaper)

    def _emit(self, signal, value):
        logger.debug('[DBUS]::%s %s', signal, value)
        self.get_dbus_connection().emit_signal(
            None,
            self.get_dbus_object_path(),
            self.get_application_id(),
            signal,
            value
        )

    def _emit_changed(self, uri):
        value = GLib.VariantBuilder.new(variant_type_from_string('r'))
        value.add_value(GLib.Variant.new_string(uri))
        self._emit('changed', value.end())

    def _emit_error(self, message):
        value = GLib.VariantBuilder.new(variant_type_from_string('r'))
        value.add_value(GLib.Variant.new_string(message))
        self._emit('error', value.end())

    def _emit_preview(self, uri):
        value = GLib.VariantBuilder.new(variant_type_from_string('r'))
        value.add_value(GLib.Variant.new_string(uri))
        self._emit('preview', value.end())

    def _handle_dbus_call(self, connection, sender, object_path, interface_name, method_name, parameters, invocation):
        logger.debug('[DBUS] %s:%s', interface_name, method_name)
        if interface_name != self.get_application_id():
            logger.warning('received invalid dbus request for interface %s', interface_name)
            return

        if method_name == 'Quit':
            invocation.return_value(None)
            self.quit()
        elif method_name == 'LoadProfile':
            profile, = parameters.unpack()
            try:
                self.load_profile(profile)
                # TODO implement auto-rotate from DBUS
                logger.warning('[DBUS] %s for method %s: auto-rotate is not observed', interface_name, method_name)
                invocation.return_value(None)
            except ValueError as e:
                invocation.return_dbus_error(self.get_application_id() + '.LoadProfile', str(e.args))
        elif method_name == 'Next':
            try:
                invocation.return_value(GLib.Variant('(s)', (self.change(),)))
            except Exception as e:
                invocation.return_dbus_error(self.get_application_id() + '.Next', str(e.args))
        elif method_name == 'Prev':
            try:
                wallpaper = self.change(True)
                if wallpaper is False:
                    logger.critical('no more wallpapers available in history')
                    invocation.return_dbus_error(
                        self.get_application_id() + '.Prev',
                        'No more wallpapers available in history'
                    )
                else:
                    invocation.return_value(GLib.Variant('(s)', (wallpaper,)))
            except ValueError as e:
                invocation.return_dbus_error(self.get_application_id() + '.Prev', str(e.args))
        else:
            logger.info('[DBUS] Method %s in %s does not exist', method_name, interface_name)
            invocation.return_dbus_error('org.freedesktop.DBus.Error.UnknownMethod',
                                         'Method %s in %s does not exist' % (method_name, interface_name))
        return

    def _handle_dbus_get(self, connection, sender, object_path, interface_name, property_name):
        try:
            value = {
                "history": GLib.Variant('as', getattr(self, 'history')),
                "queue": GLib.Variant('as', getattr(self, 'queue')),
            }[property_name]
            logger.debug('[DBUS]::Get(%s)', property_name)
        except Exception:
            logger.warning('[DBUS] Unknown property for interface %s', property_name, interface_name)
            raise Exception("failed to get %s::%s" % (interface_name, property_name))
        return value

    def _handle_dbus_set(self, connection, sender, object_path, interface_name, property_name, value):
        if property_name == "lockscreen":
            logger.debug('[DBUS]::Set(%s, %s)', property_name, value)
            self._lockscreen = bool(value)
            logger.info('extension is in %s mode', 'lockscreen' if self._lockscreen else 'desktop')
        else:
            logger.warning('[DBUS] Unknown property for interface %s', property_name, interface_name)
            raise Exception("failed to set %s::%s" % (interface_name, property_name))
        return True

    def _handle_preview(self, obj, uri):
        if isinstance(obj, LockscreenProfile) and not self._lockscreen:
            logger.debug('ignoring preview %s::preview in desktop mode', str(obj))
            return
        elif isinstance(obj, Profile) and self._lockscreen:
            logger.debug('ignoring preview %s::preview in lock screen mode', str(obj))
            return
        self._emit_preview(uri)

    def _timer_callback(self):
        return bool(self.change())

    def _toggle_timer(self, rotation_type):
        if self._timer is not None:
            self._timer.release()
            self._timer = None

        if rotation_type == 'interval':
            self._timer = IntervalTimer(self._settings.get_int('interval'), self._timer_callback)
        elif rotation_type == 'hourly':
            self._timer = HourlyTimer(self._timer_callback)
