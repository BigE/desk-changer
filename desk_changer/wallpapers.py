__author__ = 'Eric Gach <eric@php-oop.net>'

from desk_changer import settings
from gi.repository import Gio, GLib, GObject
import random

class Wallpapers(GObject.Object):
    __gsignals__ = {
        'wallpaper_next': (GObject.SignalFlags.RUN_FIRST, None, (str,))
    }

    def __init__(self, logger):
        super(Wallpapers, self).__init__()
        self._logger = logger
        self._logger.debug('initalizing wallpapers...')
        self._background = settings.Background()
        self._settings = settings.DeskChanger()
        self._init()

    def _init(self):
        self._logger.debug('initializing wallpapers for new profile')
        self._next = list()
        self._position = 0
        self._prev = list()
        self._wallpapers = list()

    def load_profile(self):
        self._init()
        # loop through all the uris in the currently loaded profile and load them
        profile = self._settings.profiles[self._settings.profile]
        for uri, recursive in profile:
            item = Gio.File.new_for_uri(uri)
            self._children(item.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None), recursive)
        self._wallpapers.sort()
        self._populate_next()

    def next(self, history=True):
        if len(self._wallpapers) == 0:
            KeyError('no available wallpapers loaded')

        if history:
            previous = self._background.picture_uri
            self._history(previous)
        wallpaper = self._next.pop(0)
        self._populate_next()
        self._logger.debug('emiting signal wallpaper_next(%s)', self._next[0])
        self.emit('wallpaper_next', self._next[0])
        return wallpaper

    @property
    def next_file(self):
        return self._next[0]

    def prev(self):
        if len(self._prev) == 0:
            self._logger.warn('no more wallpapers left in the history')
            KeyError('no wallpapers in history')

        current = self._background.picture_uri
        self._next.insert(0, current)
        self.emit('wallpaper_next', current)
        position = len(self._prev) - 1
        wallpaper = self._prev.pop(position)
        return wallpaper

    def _children(self, enumerator, recursive=False):
        for child in enumerator:
            self._parse_info(enumerator.get_container(), child, recursive)

    def _history(self, wallpaper):
        self._logger.info('adding %s to history', wallpaper)
        self._prev.append(wallpaper)
        while len(self._prev) > 20:
            # perform GC
            self._logger.debug('GC: removing %s from the history', self._prev.pop(0))

    def _parse_info(self, item, info, recursive=False):
        if recursive and info.get_file_type() == Gio.FileType.DIRECTORY:
            self._children(item.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None))
        elif info.get_content_type().startswith('image/'):
            wallpaper = item.get_uri() + '/' + info.get_name()
            self._logger.debug('adding wallpaper %s' % (wallpaper,))
            self._wallpapers.append(wallpaper)

    def _populate_next(self):
        if len(self._next) > 0:
            return

        if self._settings.random is True:
            while True:
                next = self._wallpapers[random.randint(0, len(self._wallpapers) - 1)]
                self._logger.debug('got %s as possible next wallpaper', next)
                if len(self._prev) > 0 and len(self._prev) >= len(self._wallpapers):
                    self._logger.warn('Your history is larger than your available wallpapers. Please consider decreasing the history size or adding more wallpapers to keep things more random.');
                    break
                elif self._prev.count(next) == 0 and self._next.count(next) == 0:
                    break
                elif self._prev.count(next) > 1:
                    self._logger.debug('%s has already been shown recently', next)
                elif self._next.count(next) > 1:
                    self._logger.debug('%s is already coming up', next)
            self._next.append(next)
        else:
            self._next.append(self._wallpapers[self._position])
            self._position += 1

