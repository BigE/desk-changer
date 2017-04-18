from gi.repository import GLib, Gio, GObject
from hashlib import sha256
import random
from . import logger

ACCEPTED = ['application/xml', 'image/jpeg', 'image/png']


class Profile(GObject.GObject):
    __gsignals__ = {
        'preview': (GObject.SIGNAL_RUN_LAST, GObject.TYPE_NONE, (GObject.TYPE_STRING, ))
    }

    def __init__(self, name, settings, auto_load=True):
        logger.debug('created new profile %s', name)
        GObject.GObject.__init__(self)
        self._name = name
        self._settings = settings
        # initialize variables
        self._hash = None
        self._history = []
        self._monitors = []
        self._position = 0
        self._queue = []
        self._wallpapers = []
        if auto_load:
            self.load()
        self._handler_profiles = self._settings.connect('changed::profiles', lambda s, k: self.load())
        self._handler_random = self._settings.connect('changed::random', self._changed_random)

    def emit(self, signal, *args):
        logger.debug('%s::%s %s', str(self), signal, str(args))
        GObject.GObject.emit(self, signal, *args)

    @GObject.Property(type=GObject.TYPE_STRV)
    def history(self):
        """
        
        :return: Current history of profile
        :rtype: list
        """
        return self._history

    def load(self):
        logger.debug('loading profile %s', self._name)
        # First clear everything out
        self._remove_monitors()
        self._history = []
        self._position = 0
        self._queue = []
        self._wallpapers = []
        # Now grab the
        items = self._settings.get_value('profiles').unpack().get(self._name)
        self._hash = sha256(str(items))
        if items is None:
            logger.critical('failed to load profile %s because it does not exist', self._name)
            return False
        for (uri, recursive) in items:
            logger.debug('loading %s for profile %s%s', uri, self._name, ' recursively' if recursive else '')
            try:
                location = Gio.File.new_for_uri(uri)
                self._load_profile_location(location, recursive, True)
            except GLib.Error as e:
                logger.warning('failed to load %s for profile %s: %s', uri, self._name, str(e.args))
        if len(self._wallpapers) == 0:
            logger.critical('no wallpapers were loaded for profile %s - wallpaper will not change', self._name)
            # TODO - customize exception
            raise ValueError('no wallpapers were loaded for profile %s' % (self._name,))
        if len(self._wallpapers) < 100:
            logger.warning('available total wallpapers is under 100 (%d) - strict random checking is disabled',
                           len(self._wallpapers))
        self._wallpapers.sort()
        if self._settings.get_boolean('remember-profile-state'):
            self.restore_state()
        self._load_next()
        logger.info('profile %s has been loaded with %d wallpapers', self._name, len(self._wallpapers))
        self.emit('preview', self._queue[0])

    @GObject.Property(type=str)
    def name(self):
        return self._name

    def next(self, current=None):
        if len(self._wallpapers) == 0:
            logger.critical('no wallpapers are currently available for %s', self.name)
            # TODO - customize exception
            raise ValueError('no wallpapers are currently available for %s' % (self.name,))
        wallpaper = self._queue.pop(0)
        if current:
            self._history.append(current)
        self._load_next()
        self.emit('preview', self._queue[0])
        return wallpaper

    def prev(self, current=None):
        if len(self._wallpapers) == 0:
            logger.critical('no wallpapers are currently available for %s', self.name)
            # TODO - customize exception
            raise ValueError('no wallpapers are currently available for %s' % (self.name,))
        if len(self._history) == 0:
            return False
        wallpaper = self._history.pop(0)
        if current:
            self._queue.insert(0, current)
        self.emit('preview', self._queue[0])
        return wallpaper

    @GObject.Property(type=GObject.TYPE_STRV)
    def queue(self):
        """
        
        :return: Current queue of profile
        :rtype: list
        """
        return self._queue

    def release(self):
        logger.debug('destroying profile %s', self._name)
        self._remove_monitors()
        self._settings.disconnect(self._handler_profiles)
        self._settings.disconnect(self._handler_random)

    def restore_state(self):
        logger.info('restoring state of profile %s', self.name)
        states = dict(self._settings.get_value('profile-state').unpack())
        if self.name not in states:
            logger.debug('no previous state for %s', self.name)
            return
        self._queue = list(states[self.name])
        del states[self.name]
        self._settings.set_value('profile-state', GLib.Variant('a{s(ss)}', states))

    def save_state(self, current):
        logger.debug('saving state of profile %s', self.name)
        states = dict(self._settings.get_value('profile-state').unpack())
        if len(self._queue) == 0:
            logger.critical('failed to save the state of %s: no wallpapers available', self.name)
        if self.name in states:
            logger.warning('overwriting existing state for %s', self.name)
        states[self.name] = (current, self._queue[0])
        self._settings.set_value('profile-state', GLib.Variant('a{s(ss)}', states))

    def _changed_profiles(self):
        if self._hash == sha256(str(self._settings.get_value('profiles').unpack().get(self.name))):
            logger.debug('profile is identical, not forcing a reload')
            return
        self.load()
        self.emit('preview', self._queue[0])

    def _changed_random(self):
        self._load_next(True)
        self.emit('preview', self._queue[0])

    def _files_changed(self, monitor, _file, other_file, event_type):
        logger.debug('file monitor %s changed with event type %s', _file.get_uri(), event_type)
        if event_type == Gio.FileMonitorEvent.CREATED and _file.get_file_type() in ACCEPTED:
            try:
                self._wallpapers.index(_file.get_uri())
            except ValueError:
                logger.debug('adding new wallpaper %s', _file.get_uri())
                self._wallpapers.append(_file.get_uri())
                self._wallpapers.sort()
        elif event_type == Gio.FileMonitorEvent.DELETED:
            try:
                i = self._wallpapers.index(_file.get_uri())
                logger.debug('removing deleted file %s from the list', _file.get_uri())
                self._wallpapers.pop(i)
                self._wallpapers.sort()
            except ValueError:
                pass

    def _load_next(self, clear=False):
        if clear:
            self._queue = []
            logger.info('queue forcibly cleared')
        if len(self._queue) > 0:
            logger.info('there are already %d wallpapers in the queue, skipping', len(self._queue))
            return
        wallpaper = None
        if self._settings.get_boolean('random'):
            while wallpaper is None:
                wallpaper = self._wallpapers[random.randint(0, (len(self._wallpapers) - 1))]
                logger.debug("got %s as a possible next wallpaper", wallpaper)
                if len(self._wallpapers) > 100:
                    if self._history.count(wallpaper) > 0:
                        logger.debug("%s has already been shown recently, choosing another wallpaper", wallpaper)
                        wallpaper = None
                    elif self._queue.count(wallpaper) > 0:
                        logger.debug("%s is already in the queue, choosing another wallpaper", wallpaper)
                        wallpaper = None
                elif (len(self._history) > 0 and wallpaper == self._history[0]) or (
                                len(self._queue) > 0 and wallpaper == self._queue[0]):
                    logger.info("%s is too similar, grabbing a different one", wallpaper)
                    wallpaper = None
        else:
            if self._position >= len(self._wallpapers):
                logger.debug('reached end of wallpapers, resetting counter')
                self._position = 0
            wallpaper = self._wallpapers[self._position]
        self._queue.append(wallpaper)
        logger.info('adding %s to the queue', wallpaper)

    def _load_profile_children(self, location, recursive):
        try:
            enumerator = location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None)
        except GLib.Error as e:
            logger.warning('failed to load children for location %s: %s', location.get_uri(), str(e.args))
            return
        for info in enumerator:
            child = location.resolve_relative_path(info.get_name())
            if child is None:
                logger.critical('failed to load %s', info.get_name())
                continue
            self._load_profile_location(child, recursive)

    def _load_profile_location(self, location, recursive, toplevel=False):
        try:
            info = location.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, None)
        except GLib.Error as e:
            logger.warning('failed to load location %s: %s', location.get_uri(), str(e.args))
            return
        if info.get_file_type() == Gio.FileType.DIRECTORY:
            if recursive or toplevel:
                monitor = location.monitor_directory(Gio.FileMonitorFlags.NONE, Gio.Cancellable())
                logger.debug('adding %s as directory to watch', location.get_uri())
                monitor.connect('changed', self._files_changed)
                self._monitors.append(monitor)
                logger.debug('descending into %s to find wallpapers', location.get_uri())
                self._load_profile_children(location, recursive)
        elif info.get_file_type() == Gio.FileType.REGULAR and info.get_content_type() in ACCEPTED:
            logger.debug('adding wallpaper %s', location.get_uri())
            self._wallpapers.append(location.get_uri())

    def _remove_monitors(self):
        for monitor in self._monitors:
            monitor.cancel()
        self._monitors = []


GObject.type_register(Profile)


class LockscreenProfile(Profile):
    def restore_state(self):
        logger.debug('restoring state of %s is disabled while its a lock screen profile', self.name)

    def save_state(self, current):
        logger.debug('saving state of %s is disabled while its a lock screen profile', self.name)


GObject.type_register(LockscreenProfile)
