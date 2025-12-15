#!/bin/sh -e

# This doesn't seem to be used anymore with Gnome 49
#export MUTTER_DEBUG_DUMMY_MODE_SPECS=1920x1080

# WAY more output by uncommenting these
#export G_MESSAGES_DEBUG=all
#export SHELL_DEBUG=all

# Gnome 49 debug window
dbus-run-session -- gnome-shell --devkit --wayland
# Gnome 48 and earlier
#dbus-run-session -- gnome-shell --nested

# Extension Preferences
#gnome-extensions prefs desk-changer@eric.gach.gmail.com
