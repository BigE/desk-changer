#!/usr/bin/env python3.3

import argparse
import atexit
import dbus
import dbus.mainloop.glib
import dbus.service
import errno
from gi.repository import GLib, Gio, GObject
import json
import logging
import os
import random
import signal
import sys
import time

__author__ = 'Eric Gach <eric@php-oop.net>'
__daemon_path__ = os.path.dirname(os.path.realpath(__file__))
__version__ = '0.0.1-dev'

_logger = logging.getLogger('desk-changer')


class DeskChangerDaemon(GObject.GObject):
	def __init__(self, pidfile=None):
		if pidfile is None:
			pidfile = os.path.join(os.path.dirname(__file__), 'daemon.pid')
		_logger.debug('initalizing with pidfile \'%s\'', pidfile)
		self.pidfile = pidfile
		self.is_daemon = False
		self.timer = None
		self.background = Gio.Settings('org.gnome.desktop.background')
		self.settings = DeskChangerSettings()

	def __del__(self):
		if self.timer:
			_logger.debug('removing timer %s', self.timer)
			GLib.source_remove(self.timer)
			self.timer = None

	def daemonize(self):
		_logger.debug('daemonizing')
		try:
			pid = os.fork()
			if pid > 0:
				_logger.info('first fork successful')
				sys.exit(0)
		except OSError as err:
			_logger.critical('first fork has failed: %s', err)
			sys.exit(1)

		os.chdir('/')
		os.setsid()
		os.umask(0)

		try:
			pid = os.fork()
			if pid > 0:
				_logger.info('second fork successful')
				sys.exit(0)
		except OSError as err:
			_logger.critical('second fork has failed: %s', err)
			sys.exit(1)

		sys.stdout.flush()
		sys.stderr.flush()
		si = open(os.devnull, 'r')
		so = open(os.devnull, 'a+')
		se = open(os.devnull, 'a+')
		os.dup2(si.fileno(), sys.stdin.fileno())
		os.dup2(so.fileno(), sys.stdout.fileno())
		os.dup2(se.fileno(), sys.stderr.fileno())
		self.is_daemon = True

	def delpid(self):
		_logger.info('removing pidfile %s', self.pidfile)
		os.remove(self.pidfile)

	def next(self, history=True):
		return self._set_wallpaper(self._wallpapers.next(history))

	def prev(self):
		return self._set_wallpaper(self._wallpapers.prev())

	def run(self, _dbus=False):
		_logger.debug('running the daemon %s dbus support', 'with' if _dbus else 'without')
		self._wallpapers = DeskChangerWallpapers()
		self.mainloop = GLib.MainLoop()
		if _dbus:
			self.dbus = DeskChangerDBus()
			self._wallpapers.connect('wallpaper_next', lambda obj, file: self.dbus.next_file(file))
			self.dbus.next_file(self._wallpapers.next_uri)
		if self.settings.auto_rotate:
			self.next(False)
		if self.settings.timer_enabled:
			self.timer = GLib.timeout_add_seconds(self.settings.interval, self._timeout)
		try:
			self.mainloop.run()
		except KeyboardInterrupt:
			_logger.info('keyboard interrupt, exiting')
			sys.exit(0)

	def start(self):
		_logger.debug('starting desk-changer daemon')
		try:
			with open(self.pidfile, 'r') as f:
				pid = int(f.read().strip())
				_logger.debug('found existing pid of %i', pid)
		except IOError:
			pid = None

		if pid:
			try:
				_logger.info('testing if pid %i still exists', pid)
				os.kill(pid, 0)
			except OSError as e:
				if e.errno == errno.ESRCH:
					_logger.warning('removing stale pidfile %s', self.pidfile)
					os.remove(self.pidfile)
				else:
					_logger.critical(
						'pidfile %s already exists, please ensure the daemon is not already running %s',
						self.pidfile, e
					)
					sys.exit(1)

		atexit.register(self.delpid)
		pid = int(os.getpid())
		_logger.info('daemon started with pid of %i', pid)
		with open(self.pidfile, 'w+') as f:
			f.write(str(pid))
		self.run(True)

	def stop(self):
		_logger.debug('attempting to stop daemon')
		try:
			with open(self.pidfile) as f:
				pid = int(f.read().strip())
				_logger.debug('got pid of %d', pid)
		except IOError:
			_logger.error('no pidfile was found, daemon not running?')
			return

		try:
			while 1:
				os.kill(pid, signal.SIGTERM)
				time.sleep(0.1)
		except OSError as err:
			e = str(err.args)
			if e.find('No such process') > 0:
				if os.path.exists(self.pidfile):
					os.remove(self.pidfile)
					_logger.info('killed process %d and removed pid file %s', pid, self.pidfile)
			else:
				_logger.critical(e)
				sys.exit(1)

	def _set_wallpaper(self, wallpaper):
		if wallpaper:
			_logger.info('setting wallpaper to %s', wallpaper)
			self.background.set_string('picture-uri', wallpaper)
			return wallpaper

	def _timeout(self):
		self.next()
		return True


class DeskChangerDBus(dbus.service.Object):
	bus_name = 'org.gnome.shell.extensions.desk_changer'
	bus_path = '/org/gnome/shell/extensions/desk_changer'

	def __init__(self):
		dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
		bus_name = dbus.service.BusName(self.bus_name, bus=dbus.SessionBus())
		super(DeskChangerDBus, self).__init__(bus_name, self.bus_path)

	@dbus.service.method(bus_name)
	def next(self, history=True):
		_logger.debug('[DBUS] called next()')
		dc.next(history)

	@dbus.service.signal(bus_name)
	def next_file(self, file):
		_logger.info('[DBUS] SIGNAL next_file %s', file)

	@dbus.service.method(bus_name)
	def prev(self):
		_logger.debug('[DBUS] called prev()')
		dc.prev()

	@dbus.service.method(bus_name)
	def up_next(self):
		return dc._wallpapers.next_uri


class DeskChangerSettings(Gio.Settings):
	auto_rotate = GObject.property(type=bool, default=True, nick='auto rotate',
	                               blurb='Automatically change the wallpaper at the interval specified')
	interval = GObject.property(type=int, default=300, nick='timer interval',
	                            blurb='Interval in seconds at which the timer will change the wallpaper')
	profile = GObject.property(type=str, default='gnome', nick='current profile',
	                           blurb='The currently loaded profile')
	profiles_list = GObject.property(type=str, nick='profiles',
	                            default=json.dumps({'gnome': ['/usr/share/gnome/backgrounds', True]}),
	                            blurb='List of profiles that are available to the daemon')
	random = GObject.property(type=bool, default=True, nick='random',
	                          blurb='Randomize the order in which the wallpapers are chosen')
	timer_enabled = GObject.property(type=bool, default=True, nick='timer enabled',
	                                 blurb='If the timer is enabled, the wallpaper will be changed at the specified interval')

	def __init__(self, **kwargs):
		source = Gio.SettingsSchemaSource.new_from_directory(
			os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schemas'),
			Gio.SettingsSchemaSource.get_default(),
			False
		)
		kwargs.setdefault('settings_schema', source.lookup('org.gnome.shell.extensions.desk-changer', False))
		super(DeskChangerSettings, self).__init__(None, **kwargs)
		self.bind('auto-rotate', self, 'auto_rotate', Gio.SettingsBindFlags.DEFAULT)
		self.bind('current-profile', self, 'profile', Gio.SettingsBindFlags.DEFAULT)
		self.bind('interval', self, 'interval', Gio.SettingsBindFlags.DEFAULT)
		self.bind('profiles', self, 'profiles_list', Gio.SettingsBindFlags.DEFAULT)
		self.bind('random', self, 'random', Gio.SettingsBindFlags.DEFAULT)
		self.bind('timer-enabled', self, 'timer_enabled', Gio.SettingsBindFlags.DEFAULT)

	def get_json(self, key):
		return json.loads(self.get_string(key))

	def set_json(self, key, value):
		self.set_string(key, json.dumps(value))

	@property
	def profiles(self):
		return self.get_json('profiles')

	@profiles.setter
	def profiles(self, value):
		self.set_json('profiles', value)


class DeskChangerWallpapers(GObject.GObject):
	__gsignals__ = {'wallpaper_next': (GObject.SignalFlags.RUN_FIRST, None, (str,))}

	def __init__(self):
		_logger.debug('initalizing wallpapers')
		super(DeskChangerWallpapers, self).__init__()
		self._background = Gio.Settings('org.gnome.desktop.background')
		self._settings = DeskChangerSettings()
		self._profile_handler = self._settings.connect('changed::current-profile', self._profile_changed)
		self.load_profile()

	def load_profile(self):
		if hasattr(self, '_monitors'):
			for monitor in self._monitors:
				monitor.cancel()
		self._monitors = []
		self._next = []
		self._position = 0
		self._prev = []
		self._wallpapers = []
		_logger.info('loading profile %s', self._settings.profile)
		profile = self._settings.profiles[self._settings.profile]
		for uri, recursive in profile:
			_logger.debug('loading %s%s', uri, ' recursively' if recursive else '')
			location = Gio.File.new_for_uri(uri)
			if location.query_file_type(Gio.FileQueryInfoFlags.NONE, None) == Gio.FileType.DIRECTORY:
				monitor = location.monitor_directory(Gio.FileMonitorFlags.SEND_MOVED, Gio.Cancellable())
				_logger.debug('adding %s as directory to watch', uri)
				monitor.connect('changed', self._files_changed)
				self._monitors.append(monitor)
			self._children(location.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None), recursive)
		self._wallpapers.sort()
		self._load_next()

	def next(self, history=True):
		if len(self._wallpapers) == 0:
			_logger.critical('no avaliable wallpapers loaded')
			ValueError('no available wallpapers loaded')

		if history:
			self._history(self._background.get_string('picture-uri'))
		wallpaper = self._next.pop(0)
		self._load_next()
		self.emit('wallpaper_next', self._next[0])
		return wallpaper

	def prev(self):
		if len(self._prev) == 0:
			_logger.warning('no more wallpapers in the history')
			return

		current = self._background.get_string('picture-uri')
		self._next.insert(0, current)
		self.emit('wallpaper_next', current)
		position = len(self._prev) - 1
		wallpaper = self._prev.pop(position)
		return wallpaper

	def _children(self, enumerator, recursive=False):
		for child in enumerator:
			self._parse_info(enumerator.get_container(), child, recursive)

	def _files_changed(self, monitor, file, other_file, event_type):
		if event_type == Gio.FileMonitorEvent.CREATED:
			_logger.debug('adding new file to the list: %s', file.get_uri())
			self._wallpapers.append(file.get_uri())
			self._wallpapers.sort()
		elif event_type == Gio.FileMonitorEvent.DELETED:
			i = self._wallpapers.index(file.get_uri())
			if i:
				_logger.debug('removing deleted file from the list: %s', file.get_uri())
				self._wallpapers.pop(i)
				self._wallpapers.sort()
		elif event_type == Gio.FileMonitorEvent.MOVED:
			_logger.debug('file %s was moved to %s', file.get_uri(), other_file.get_uri())

	def _history(self, wallpaper):
		_logger.debug('adding wallpaper %s to the history', wallpaper)
		self._prev.append(wallpaper)
		while len(self._prev) > 20:
			_logger.debug('[GC] removing %s from the history', self._prev.pop(0))

	def _load_next(self):
		if len(self._next) > 0:
			_logger.debug('wallpapers already loaded, skipping')
			return

		if self._settings.random is True:
			_next = None
			while True:
				_next = self._wallpapers[random.randint(0, len(self._wallpapers) - 1)]
				_logger.debug('got %s as a possible next wallpaper', _next)
				if len(self._prev) > 0 and len(self._prev) >= len(self._wallpapers):
					_logger.warning('Your history is larger than the available wallpapers on the current profile')
					break
				elif self._prev.count(_next) == 0 and self._next.count(_next) == 0:
					break
				elif self._prev.count(_next) > 1:
					_logger.debug('the wallpaper %s has recently been shown, picking a new one', _next)
				elif self._next.count(_next) > 1:
					_logger.debug('the wallpaper %s is already up next', _next)
			self._next.append(_next)
		else:
			self._next.append(self._wallpapers[self._position])
			self._position += 1

	def _parse_info(self, item, info, recursive=False):
		if recursive and info.get_file_type() == Gio.FileType.DIRECTORY:
			self._children(item.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None), recursive)
		elif info.get_content_type().startswith('image/'):
			wallpaper = item.get_uri() + '/' + info.get_name()
			_logger.debug('adding wallpaper %s', wallpaper)
			self._wallpapers.append(wallpaper)

	def _profile_changed(self, y, z):
		_logger.info('profile has changed, reloading')
		self.load_profile()
		if self._settings.auto_rotate:
			dc.next(False)

	@property
	def next_uri(self):
		if len(self._next) == 0:
			_logger.warning('no wallpaper available for next_uri')
			return None
		return self._next[0]


if __name__ == '__main__':
	parser = argparse.ArgumentParser(description='DeskChanger Daemon')
	parser.add_argument('-f', '--foreground', dest='daemon', action='store_false', default=True,
	                    help='Prevent the daemon from forking off and running in the background.')
	parser.add_argument('--logfile', dest='logfile', action='store', default=__daemon_path__+'/daemon.log',
	                    help='Log file to output logging to, default: %s' % __daemon_path__+'/daemon.log')
	parser.add_argument('--logformat', dest='format', action='store',
	                    default='[%(asctime)s %(levelname)-8s] %(name)s: %(message)s',
	                    help='Change the logging format')
	parser.add_argument('--loglevel', dest='level', action='store', default='WARNING',
	                    choices=('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'),
	                    help='Set the default logging level')
	parser.add_argument('-v', '--verbose', dest='verbose', action='store_true', default=False,
	                    help='Display logging output to stderr')
	parser.add_argument('--version', action='version', version=__version__)
	parser.add_argument('action', choices=('start', 'stop', 'restart', 'status'),
	                    help='Control the daemon process or check the status.')
	args = parser.parse_args()
	_logger.setLevel(args.level)

	if args.verbose:
		handler = logging.StreamHandler(sys.stderr)
		handler.setFormatter(logging.Formatter(args.format))
		_logger.addHandler(handler)

	try:
		logfile = open(args.logfile, 'w')
		handler = logging.StreamHandler(logfile)
		handler.setFormatter(logging.Formatter(args.format))
		_logger.addHandler(handler)
	except IOError as e:
		_logger.critical('cannot open log file %s', args.logfile)

	if args.action == 'status':
		args.daemon = False
	dc = DeskChangerDaemon()
	if args.daemon:
		dc.daemonize()

	if args.action == 'start':
		dc.start()
	elif args.action == 'stop':
		dc.stop()
	elif args.action == 'restart':
		dc.stop()
		dc.start()
	elif args.action == 'status':
		dc.status()
