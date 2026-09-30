#!/bin/sh -e

DEBUG=0
PREFS=0

usage() {
    echo "Usage: $0 [-d|--debug] [-p|--prefs] [-h|--help]"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--debug)
            DEBUG=1
            shift
            ;;
        -p|--prefs)
            PREFS=1
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

if [ $DEBUG -eq 1 ]; then
    export G_MESSAGES_DEBUG="Gjs-Console GNOME Shell Gjs"
    export SHELL_DEBUG=all
fi

GNOME_SHELL_VERSION=$(gnome-shell --version | cut -d ' ' -f 3| cut -d '.' -f 1)

# This doesn't seem to be used anymore with Gnome 49
#export MUTTER_DEBUG_DUMMY_MODE_SPECS=1920x1080

if [ $PREFS -eq 1 ]; then
    # Extension Preferences
    dbus-update-activation-environment --verbose \
    G_MESSAGES_DEBUG="$G_MESSAGES_DEBUG" \
    G_RESOURCE_OVERLAYS="/org/gnome/shell/extensions/desk-changer=$(pwd)/resources"

    gnome-extensions prefs desk-changer@eric.gach.gmail.com

    dbus-update-activation-environment --verbose \
    G_MESSAGES_DEBUG= G_RESOURCE_OVERLAYS=
else

    if [ $GNOME_SHELL_VERSION -le 48 ]; then
        # Gnome 48 and earlier
        dbus-run-session -- gnome-shell --nested
    else
        # Gnome 49 and above debug window
        dbus-run-session -- gnome-shell --devkit --wayland
    fi
fi
