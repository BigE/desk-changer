__author__ = 'Eric Gach'

import dbus
import dbus.mainloop.glib
import dbus.service

class DBusService(dbus.service.Object):
    bus_name = 'org.gnome.DeskChanger'
    bus_path = '/org/gnome/DeskChanger'

    def __init__(self, daemon):
        self.daemon = daemon
        dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
        bus_name = dbus.service.BusName(self.bus_name, bus=dbus.SessionBus())
        super(DBusService, self).__init__(bus_name, self.bus_path)

    @dbus.service.method(bus_name)
    def Next(self, history=True):
        self.daemon.logger.debug('[DBUS] Next(%s)', history)
        return self.daemon.next_wallpaper(history)

    @dbus.service.signal(bus_name)
    def NextFile(self, file):
        self.daemon.logger.debug('[DBUS] emit NextFile(%s)', file)

    @dbus.service.method(bus_name)
    def PreviewNext(self):
        self.daemon.logger.debug('[DBUS] NextFile()')
        return self.daemon.wallpapers.next_file

    @dbus.service.method(bus_name)
    def Prev(self):
        self.daemon.logger.debug('[DBUS] Prev()')
        return self.daemon.prev_wallpaper()
