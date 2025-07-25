# DeskChanger

DeskChanger is a gnome-shell wallpaper slideshow extension with multiple
profile support. The extension allows you to switch profiles on the fly
without reloading the service.

## Screenshots

<img src="./screenshot-1.png?raw=true" width="256" title="Screenshot of menu">
<img src="./screenshot-2.png?raw=true" width="256" title="Screenshot of notification">

## Requirements

The requirements are for the most recent version of the plugin. Previous
versions support older versions of gnome-shell.

* gnome-shell 45 or higher

## Install

### Requirements

 * gettext (for translations)
 * make (not required - to build without make just follow the steps in the 
Makefile and run the commands manually)
 * yarn (for installing the necessary tools to compile the TypeScript)

First clone the repo and run the following install instructions.

```
git clone -b develop git@github.com:BigE/desk-changer.git
cd desk-changer
make all
```

Once the make process is complete, you can then run `make install` to install
the extension to your local directory. If you want to install it to the
system, run make as root with DESTDIR or just copy the
desk-changer&commat;eric.gach.gmail.com folder to your
`/usr/share/gnome-shell/extensions/` folder.

```
# make DESTDIR=/usr install
```
OR
```
# cp -r dist /usr/share/gnome-shell/extensions/desk-changer@eric.gach.gmail.com
```

Then restart gnome-shell and enable the extension. Once it is enabled, you can
use the extension to start the daemon with the built-in toggle switch.

## General Information
### Daemon

The daemon is now part of the extension itself and has no command line
interface. The only interface available to the daemon now is the DBus
interface.

#### DBUS Interface

***IMPORTANT* This has changed since version 36 of the extension**

The DBus interface is available for interaction with the service itself. The
interface exposes most of the service runner as well as read only properties
for pulling information from the service. There are also signals available
for specific events within the service.

**Name**: `org.gnome.Shell.Extensions.DeskChanger.Service`

**Path**: `/org/gnome/Shell/Extensions/DeskChanger/Service`

##### Methods
* `Load(String profile)` Loads the specified profile and respective locations
* `Next()` Switches to the next wallpaper, returns the uri
* `Prev()` Switches to the previous wallpaper, returns the uri
* `Restart()` Automatically issues a Stop/Start, service must be running
* `Start()` Enables automatic rotation and makes the service available
* `Stop()` Disables automatic rotation and makes the service unavailable for
use.

##### Properties
* GameMode - Read only boolean value if GameMode is detected and enabled
* History - Read only array of history
* Preview - Read only URI of the next wallpaper
* Queue - Read only array of the queue
* Running - Read only boolean value if the daemon is stopped or started

##### Signals
* Changed - Emitted when the wallpaper is changed, uri to wallpaper file
* Start - Emitted when the service is started
* Stop - Emitted when the service is stopped


### dconf-editor

To view the settings in dconf-editor, just use the `GSETTINGS_SCHEMA_DIR=`
environment variable to open dconf-editor with the extensions schema available
to the editor.

>$ GSETTINGS_SCHEMA_DIR=~/.local/share/gnome-shell/extensions/desk-changer@eric.gach.gmail.com/schemas/ dconf-editor /org/gnome/shell/extensions/desk-changer

Then navigate to `/org/gnome/shell/extensions/desk-changer` and you will see
all of the available settings for the extension and daemon.
