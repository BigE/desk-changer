__author__ = 'Eric Gach <eric@php-oop.net>'

import json
import os.path
from gi.repository import Gio, GObject

def profiles_setter_format(item):
    print(item)


class Background(Gio.Settings):
    picture_uri = GObject.property(type=str, nick='picture uri',
                                   blurb='This is the uri to the picture being used as the background')
    def __init__(self, **kwargs):
        super(Background, self).__init__('org.gnome.desktop.background', **kwargs)
        self.bind('picture-uri', self, 'picture_uri', Gio.SettingsBindFlags.DEFAULT)

class DeskChanger(Gio.Settings):
    auto_rotate = GObject.property(type=bool, default=True, nick='auto rotate',
                                   blurb='Automatically change the wallpaper when the profile changes')
    interval = GObject.property(type=int, default=300, nick='timer interval',
                                blurb='Interval at which the timer will rotate the wallpaper')
    profile = GObject.property(type=str, nick='current profile',
                               blurb='This is the currently loaded profile')
    profile_list = GObject.property(type=str, nick='profiles',
                                blurb='These are all the profiles that are available')
    random = GObject.property(type=bool, default=True, nick='random wallpapers',
                              blurb='Enabling this will cause the wallpapers to rotate in a random order')
    timer_enabled = GObject.property(type=bool, default=True, nick='timer enabled',
                                     blurb='This will cause the wallpaper to rotate every interval')

    def __init__(self, **kwargs):
        source = Gio.SettingsSchemaSource.new_from_directory(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schemas'),
            Gio.SettingsSchemaSource.get_default(),
            False
        )
        kwargs.setdefault('settings_schema', source.lookup('org.gnome.desk-changer', False))
        super(DeskChanger, self).__init__(None, **kwargs)
        self.bind('auto-rotate', self, 'auto_rotate', Gio.SettingsBindFlags.DEFAULT)
        self.bind('current-profile', self, 'profile', Gio.SettingsBindFlags.DEFAULT)
        self.bind('interval', self, 'interval', Gio.SettingsBindFlags.DEFAULT)
        self.bind('profiles', self, 'profile_list', Gio.SettingsBindFlags.DEFAULT)
        self.bind('random', self, 'random', Gio.SettingsBindFlags.DEFAULT)
        self.bind('timer-enabled', self, 'timer_enabled', Gio.SettingsBindFlags.DEFAULT)

    def get_json(self, key):
        return json.loads(self.get_string(key))

    def set_json(self, key, value):
        self.set_string(key, json.dumps(value))

    @property
    def profiles(self):
        return json.loads(self.profile_list)

    @profiles.setter
    def profiles(self, value):
        self.profile_list = json.dumps(value)
