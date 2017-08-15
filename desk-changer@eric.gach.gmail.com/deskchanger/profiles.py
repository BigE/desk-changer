from abc import ABCMeta, abstractmethod
from gi.repository import GLib, Gio, GObject
from hashlib import sha256
import random
from . import logger
from .wallpapers import ACCEPTED


class BaseProfile(GObject.GObject):
    """
    This is my attempt to make the profiles more of a container than a part of the application. My hope is, this will
    make further attempts to work on the timer and Daemon much easier.
    """

    __gsignals__ = {
        # emitted when a wallpaper is changed
        'changed': (GObject.SIGNAL_RUN_LAST, GObject.TYPE_NONE, (GObject.TYPE_STRING,)),
        # emitted when a wallpaper is added to the queue
        'preview': (GObject.SIGNAL_RUN_LAST, GObject.TYPE_NONE, (GObject.TYPE_STRING,)),
    }

    def __init__(self, name):
        GObject.GObject.__init__(self)
        self._loaded = False
        self._name = name
        self._handler_profiles = None
        self._handler_random = None
        self._hash = None
        self._history = []
        self._monitors = []
        self._position = 0
        self._queue = []
        self._wallpapers = []
        self._settings = Gio.Settings.new('org.gnome.shell.extensions.desk-changer')
        self._handler_profiles = self._settings.connect('changed::profiles', self._changed_profile)
        self._handler_random = self._settings.connect('changed::random', self._changed_random)
        logger.debug('successfully created %s', self)

    def __repr__(self):
        return '%s(%s)' % (self.__class__.__name__, self.name)

    def destroy(self):
        """
        Call this to properly cleanup the profile before it is actually destroyed
        """
        self._remove_monitors()
        self._settings.disconnect(self._handler_profiles)
        self._settings.disconnect(self._handler_random)
        del self._settings

    def emit(self, signal, *args):
        """
        Override the base emit because we want logging
        :param signal: Signal to emit
        :type signal: string
        :param args: Arguments to pass to signal handler
        """
        logger.debug('%s::%s %s', self, signal, str(args))
        GObject.GObject.emit(self, signal, *args)

    @GObject.Property(type=GObject.TYPE_STRV)
    def history(self):
        return self._history

    def load(self):
        logger.debug('loading profile %s', self.name)
        # first, clear all the previous information
        self._remove_monitors()
        self._history = []
        self._hash = None
        self._position = 0
        self._queue = []
        self._wallpapers = []
        self._loaded = False
        items = self._settings.get_value('profiles').unpack().get(self.name, None)
        if items is None:
            raise NotFoundError(self.name)
        for (uri, recursive) in items:
            self._load_uri(uri, recursive, True)
        if len(self._wallpapers) == 0:
            logger.critical('no wallpapers were loaded from %d locations for profile %s', len(items), self.name)
            raise WallpaperNotFoundError(self.name)
        if len(self._wallpapers) < 100:
            logger.warning('available wallpapers for %s is under 100 (%d) - strict random checking is disabled',
                           self.name, len(self._wallpapers))
        # put them in order in case we go by position
        self._wallpapers.sort()
        if self._settings.get_boolean('remember-profile-state'):
            self.restore_state()
        self._load_queue()
        self._hash = sha256(str(items).encode('utf-8'))
        if self._settings.get_boolean('auto-rotate'):
            self.next()
        logger.debug('successfully loaded %s with %d wallpapers', self.name, len(self._wallpapers))
        # we set this after the auto-rotate check, this way the wallpaper is not added to the history
        self._loaded = True

    @GObject.Property(type=str)
    def name(self):
        return self._name

    @abstractmethod
    def next(self):
        raise NotImplementedError()

    @abstractmethod
    def prev(self):
        raise NotImplementedError()

    @GObject.Property(type=GObject.TYPE_STRV)
    def queue(self):
        return self._queue

    def restore_state(self):
        logger.info('restoring state of %s is disabled while type %s', self.name, self)

    def save_state(self):
        logger.info('saving state of %s is disabled while type %s', self.name, self)

    def _changed_profile(self, obj, key):
        if self._hash == sha256(str(self._settings.get_value(key).unpack().get(self.name)).encode('utf-8')):
            logger.info('not reloading profile, hashes match')
            return
        self.load()

    def _changed_random(self, obj, key):
        self._loaded = False
        self._queue = []
        self._load_queue()
        if self._settings.get_boolean('auto-rotate'):
            self.next()
        self._loaded = True

    def _files_changed(self, monitor, _file, other_file, event_type):
        logger.debug('file monitor %s changed with event type %s', _file.get_uri(), event_type)
        if event_type == Gio.FileMonitorEvent.CREATED:
            # TODO make recursive flag dynamic
            self._load_uri(_file.get_uri(), False)
        elif event_type == Gio.FileMonitorEvent.DELETED:
            try:
                i = self._wallpapers.index(_file.get_uri())
                logger.debug('removing deleted file %s from the list', _file.get_uri())
                self._wallpapers.pop(i)
                self._wallpapers.sort()
            except ValueError:
                pass

    def _load_children(self, location, recursive):
        try:
            enumerator = location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None)
        except GLib.Error as e:
            logger.warning('unable to enumerate %s for %s: %s', location.get_uri(), self.name, str(e.args))
            return
        for info in enumerator:
            child = location.resolve_relative_path(info.get_name())
            if child is None:
                logger.warning('failed to load %s for %s', info.get_name(), self.name)
                continue
            self._load_uri(child.get_uri(), recursive)

    def _load_queue(self, current=None):
        if len(self._queue) > 0:
            logger.info('there are already %d wallpapers in the queue, skipping', len(self._queue))
            self.emit('preview', self._queue[0])
            return
        if self._settings.get_boolean('random'):
            wallpaper = self._load_queue_random(current)
        else:
            if self._position == len(self._wallpapers):
                self.info('reached end of profile %s, resetting counter to beginning', self)
                self._position = 0
            wallpaper = self._wallpapers[self._position]
            self._position += 1
        self._queue.append(wallpaper)
        self.emit('preview', wallpaper)
        logger.info('added %s to the queue for %s', wallpaper, self)

    def _load_queue_random(self, current):
        wallpaper = None
        while wallpaper is None:
            wallpaper = self._wallpapers[random.randint(0, (len(self._wallpapers) - 1))]
            logger.debug("got %s as a possible next wallpaper", wallpaper)
            if len(self._wallpapers) >= 100 and self._history.count(wallpaper) > 0:
                logger.debug("%s has already been shown recently, choosing another wallpaper", wallpaper)
                wallpaper = None
            elif len(self._wallpapers) >= 100 and self._queue.count(wallpaper) > 0:
                logger.debug("%s is already in the queue, choosing another wallpaper", wallpaper)
                wallpaper = None
            elif (len(self._history) > 0 and wallpaper == self._history[0]) or \
                    (len(self._queue) > 0 and wallpaper == self._queue[0]) or (wallpaper == current):
                logger.info("%s is too similar, grabbing a different one", wallpaper)
                wallpaper = None
        return wallpaper

    def _load_uri(self, uri, recursive, top_level=False):
        try:
            location = Gio.File.new_for_uri(uri)
            info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, None)
        except GLib.Error as e:
            logger.warning('failed to load location %s: %s', uri, str(e.args))
            return
        if info.get_file_type() == Gio.FileType.DIRECTORY and (recursive or top_level):
            monitor = location.monitor_directory(Gio.FileMonitorFlags.NONE, Gio.Cancellable())
            logger.debug('adding %s as directory to watch', location.get_uri())
            monitor.connect('changed', self._files_changed)
            self._monitors.append(monitor)
            logger.debug('descending into %s to find wallpapers', location.get_uri())
            self._load_children(location, recursive)
        elif info.get_file_type() == Gio.FileType.REGULAR and info.get_content_type() in ACCEPTED:
            logger.debug('adding wallpaper %s', location.get_uri())
            if location.get_uri() in self._wallpapers:
                logger.warning('%s already loaded, skipping duplicate', location.get_uri())
                return
            self._wallpapers.append(location.get_uri())

    def _next(self, current=None):
        if len(self._wallpapers) == 0:
            logger.critical('no wallpapers are currently loaded for %s', self)
            raise WallpaperNotFoundError(self)
        wallpaper = self._queue.pop(0)
        if current:
            self._history.append(current)
        self._load_queue(current)
        return wallpaper

    def _prev(self, current):
        if len(self._wallpapers) == 0:
            logger.critical('no wallpapers are currently loaded for %s', self)
            raise WallpaperNotFoundError(self.name)
        if len(self._history) == 0:
            logger.info('no wallpapers available in history for %s', self)
            return False
        wallpaper = self._history.pop()
        self._queue.insert(0, current)
        self.emit('preview', self._queue[0])
        return wallpaper

    def _remove_monitors(self):
        for monitor in self._monitors:
            logger.debug('removing monitor %s', monitor)
            monitor.cancel()
            del monitor
        self._monitors = []


class DesktopProfile(BaseProfile):
    def __init__(self, name):
        self._background = Gio.Settings.new('org.gnome.desktop.background')
        self._lockscreen = None
        super(DesktopProfile, self).__init__(name)
        if self._settings.get_boolean('update-lockscreen') and \
                        len(self._settings.get_string('lockscreen-profile')) == 0:
            self._lockscreen = Gio.Settings.new('org.gnome.desktop.screensaver.background')
        self._settings.connect('changed::update-lockscreen', self._update_lockscreen)
        self._settings.connect('changed::lockscreen-profile', self._update_lockscreen)

    def destroy(self):
        del self._background
        super(DesktopProfile, self).destroy()

    def next(self):
        current = None
        if self._loaded is True:
            current = self._background.get_string('picture-uri')
        wallpaper = self._next(current)
        if wallpaper:
            self._set_wallpaper(wallpaper)
        return wallpaper

    def prev(self):
        current = None
        if self._loaded is True:
            current = self._background.get_string('picture-uri')
        wallpaper = self._prev(current)
        if wallpaper:
            self._set_wallpaper(wallpaper)
        return wallpaper

    def restore_state(self):
        logger.info('restoring state of profile %s', self.name)
        states = dict(self._settings.get_value('profile-state').unpack())
        if self.name not in states:
            logger.debug('no previous state for %s', self.name)
            return
        self._queue = list(states[self.name])
        del states[self.name]
        self._settings.set_value('profile-state', GLib.Variant('a{s(ss)}', states))

    def save_state(self):
        logger.debug('saving state of profile %s', self.name)
        states = dict(self._settings.get_value('profile-state').unpack())
        if len(self._queue) == 0:
            logger.critical('failed to save the state of %s: no wallpapers available', self.name)
        if self.name in states:
            logger.warning('overwriting existing state for %s', self.name)
        states[self.name] = (self._background.get_string('picture-uri'), self._queue[0])
        self._settings.set_value('profile-state', GLib.Variant('a{s(ss)}', states))

    def _set_wallpaper(self, wallpaper):
        self._background.set_string('picture-uri', wallpaper)
        if self._lockscreen:
            self._lockscreen.set_string('picture-uri', wallpaper)
        self.emit('changed', wallpaper)

    def _update_lockscreen(self):
        update = self._settings.get_boolean('update-lockscreen')
        profile = self._settings.get_string('lockscreen-profile')
        if not update or (update and profile is not '') and self._lockscreen is not None:
            logger.debug('destroying lockscreen settings from %s', self)
            self._lockscreen.destroy()
            self._lockscreen = None
        elif update and profile is '' and self._lockscreen is None:
            logger.debug('creating lockscreen settings for %s', self)
            self._lockscreen = Gio.Settings.new('org.gnome.desktop.screensaver.background')


class LockscreenProfile(BaseProfile):
    def __init__(self, name):
        self._background = Gio.Settings.new('org.gnome.desktop.screensaver.background')
        super(LockscreenProfile, self).__init__(name)

    def destroy(self):
        del self._background
        super(LockscreenProfile, self).destroy()

    def next(self):
        current = None
        if self._loaded:
            current = self._background.get_string('picture-uri')
        return self._next(current)

    def prev(self):
        return self._prev(self._background.get_string('picture-uri'))


class ProfileError(Exception):
    __metaclass__ = ABCMeta


class NotFoundError(ProfileError):
    def __init__(self, name):
        super(NotFoundError, self).__init__('Profile %s does not exist' % (name,))


class WallpaperNotFoundError(ProfileError):
    def __init__(self, name):
        super(WallpaperNotFoundError, self).__init__('No wallpapers loaded for %s' % (name,))
