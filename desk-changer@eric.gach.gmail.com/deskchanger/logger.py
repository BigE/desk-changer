from gi.repository import GLib


def critical(message, *args):
    log(GLib.LogLevelFlags.LEVEL_CRITICAL, message, *args)


def error(message, *args):
    log(GLib.LogLevelFlags.LEVEL_ERROR, message, *args)


def debug(message, *args):
    log(GLib.LogLevelFlags.LEVEL_DEBUG, message, *args)


def info(message, *args):
    log(GLib.LogLevelFlags.LEVEL_INFO, message, *args)


def log(level, message, *args):
    message = str(message) % args
    GLib.log_default_handler(None, level, message)


def warning(message, *args):
    log(GLib.LogLevelFlags.LEVEL_WARNING, message, *args)
