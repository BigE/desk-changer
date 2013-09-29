__author__ = 'Eric Gach <eric@php-oop.net>'
__version__ = '0.0.1-dev'

import atexit
import ctypes
from desk_changer import settings
from desk_changer.wallpapers import Wallpapers
from gi.repository import GLib, GObject
import errno
import logging
import os
import signal
import sys
import time


class Daemon(GObject.GObject):
	logger = logging.getLogger('desk-changer-daemon')

	def __init__(self, pidfile):
		self.logger.debug('initalizing with pidfile \'%s\'', pidfile)
		self.is_daemon = False
		self.pidfile = pidfile
		self._settings = settings.DeskChanger()
		self._settings.connect('changed::current-profile', self.profile_changed)
		self._background = settings.Background()
		self.timer = None

	def daemonize(self):
		"""Damenoize class. UNIX double fork mechanism."""
		self.logger.debug('daemonizing')
		try:
			pid = os.fork()
			if pid > 0:
				self.logger.info('first fork successful')
				# exit first parent
				sys.exit(0)
		except OSError as err:
			self.logger.critical('first fork has failed: %s', err)
			sys.exit(1)

		# reset some stuff from the original environment
		os.chdir('/')
		os.setsid()
		os.umask(0)

		# second fork
		try:
			pid = os.fork()
			if pid > 0:
				self.logger.info('second fork successful')
				# exit from second parent
				sys.exit(0)
		except OSError as err:
			self.logger.critical('second fork has failed: %s', err)
			sys.exit(1)

		# redirect std file descriptors
		sys.stdout.flush()
		sys.stderr.flush()
		si = open(os.devnull, 'r')
		so = open(os.devnull, 'a+')
		se = open(os.devnull, 'a+')
		os.dup2(si.fileno(), sys.stdin.fileno())
		os.dup2(so.fileno(), sys.stdout.fileno())
		os.dup2(se.fileno(), sys.stderr.fileno())

		self.is_daemon = True

	def __del__(self):
		if self.timer:
			self.logger.debug('removing timer %s', self.timer)
			GLib.source_remove(self.timer)
			self.timer = None

	def delpid(self):
		"""Remove the pid file from the system"""
		self.logger.debug('removing the pidfile %s', self.pidfile)
		os.remove(self.pidfile)

	def next_wallpaper(self, history=True):
		next = self.wallpapers.next(history)
		self.logger.info('next: changing wallpaper to %s', next)
		self._background.picture_uri = next
		return next

	def prev_wallpaper(self):
		try:
			wallpaper = self.wallpapers.prev()
			self.logger.info('prev: changing wallpaper to %s', wallpaper)
			self._background.picture_uri = wallpaper
		except KeyError as e:
			return e.message
		return wallpaper

	def profile_changed(self, settings, key):
		self.logger.info('profile changed to %s', self._settings.profile)
		self.wallpapers.load_profile()
		if self._settings.auto_rotate:
			self.next_wallpaper(False)

	def restart(self):
		self.logger.debug('restarting daemon')
		self.stop()
		self.start()

	def run(self, _dbus=False):
		libc = ctypes.cdll.LoadLibrary('libc.so.6')
		libc.prctl(15, 'desk-changer-daemon', 0, 0, 0)
		self.logger.debug('running daemon %s dbus', 'with' if _dbus else 'without')
		self.wallpapers = Wallpapers(self.logger)
		self.wallpapers.load_profile()
		if self._settings.auto_rotate:
			self.next_wallpaper(False)
		if self._settings.timer_enabled:
			self.timer = GLib.timeout_add_seconds(self._settings.interval, self._timer_timeout)
		self.mainloop = GLib.MainLoop()
		if _dbus:
			from .dbus import DBusService
			dbussrv = DBusService(self)
			self.wallpapers.connect('wallpaper_next', lambda obj, file: dbussrv.NextFile(file))
			dbussrv.NextFile(self.wallpapers.next_file)
		self.mainloop.run()

	def start(self):
		"""Start the daemon"""
		self.logger.debug('starting the daemon')
		try:
			with open(self.pidfile, 'r') as pf:
				pid = pf.read().strip()
				self.logger.warn('got pid %i on start', pid)
		except IOError:
			pid = None

		if pid:
			try:
				self.logger.info('attempting to test if pid %i exists', pid)
				os.kill(pid, 0)
			except OSError as e:
				if e[0] == errno.ESRCH:
					self.logger.warn('removing stale pid file %s', self.pidfile)
					os.remove(self.pidfile)
				else:
					self.logger.critical('pidfile %s already exits, check if the daemon is already running: %s', self.pidfile, e[1])
					sys.exit(1)

		atexit.register(self.delpid)
		# write the pid to the pidfile
		pid = os.getpid()
		self.logger.debug('daemon started with pid %i', pid)
		with open(self.pidfile, 'w+') as f:
			f.write(str(pid) + '\n')

		try:
			from ctypes import CDLL, create_string_buffer, byref
			libc = CDLL('libc.so.6')
			process_name = str(type(self).__name__)
			cprocess_name = create_string_buffer(len(process_name) + 1)
			cprocess_name.value = bytes(process_name.encode('utf-8'))
			libc.prctl(15, byref(cprocess_name), 0, 0, 0)
		except ImportError:
			pass
		except Exception as e:
			sys.exit(e)

		self.run(True)

	def status(self):
		self.logger.debug('checking status of daemon')
		try:
			with open(self.pidfile, 'r') as pf:
				pid = int(pf.read().strip())
				self.logger.debug('got pid %i', pid)
		except IOError:
			pid = 0

		if pid:
			status = 'running'
		else:
			status = 'stopped'

		self.logger.info('daemon is %s', status)
		return status, pid

	def stop(self):
		self.logger.debug('attempting to stop the daemon')
		try:
			with open(self.pidfile, 'r') as pf:
				pid = int(pf.read().strip())
				self.logger.debug('got pid %i', pid)
		except IOError:
			self.logger.error('pidfile %s dose not exist or the daemon is not running', self.pidfile)
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
					self.logger.info('killed process %i and removed pidfile %s', pid, self.pidfile)
			else:
				self.logger.critical(str(err.args))
				sys.exit(1)

	def _timer_timeout(self):
		self.next_wallpaper()
		return True
