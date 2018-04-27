from abc import ABCMeta
from datetime import datetime
from gi.repository import GLib
from . import logger


class Timer(object):
    __metaclass__ = ABCMeta

    def __init__(self, interval, callback):
        if interval < 1:
            # another attempt to prevent #50
            raise ValueError
        self._callback = callback
        self._interval = interval
        self._source_id = GLib.timeout_add_seconds(interval, self.__callback__)
        logger.debug('added timer for %d seconds', self._interval)

    def __repr__(self):
        return '%s(interval=%s, callback=%s)' % (self.__class__.__name__, self._interval, self._callback)

    def __callback__(self):
        if not callable(self._callback):
            logger.critical('callback for timer is not callable')
            return False
        return bool(self._callback())

    def release(self):
        if self._source_id:
            logger.debug('removing timer %d', self._source_id)
            GLib.source_remove(self._source_id)


class HourlyTimer(Timer):
    def __init__(self, callback):
        self._did_hourly = False
        super(HourlyTimer, self).__init__(5, callback)

    def __repr__(self):
        return 'HourlyTimer(callback=%s)' % (self._callback, )

    def __callback__(self):
        d = datetime.utcnow()
        if d.minute == 0 and d.second < 10:
            if not self._did_hourly:
                # This should trigger once per hour, right around the beginning of the hour... I hope... I tried to
                # account for it not being accurately 5 second intervals
                self._did_hourly = True
                return super(HourlyTimer, self).__callback__()
            return True
        self._did_hourly = False
        return True


class IntervalTimer(Timer):
    pass
