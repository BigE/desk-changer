# DeskChanger

DeskChanger is a gnome-shell wallpaper slideshow extension with multiple
profile support. The extension allows you to switch profiles on the fly
without reloading the daemon.

## Screenshots

<img src="./screenshot-1.png?raw=true" width="256" title="Screenshot of menu">
<img src="./screenshot-2.png?raw=true" width="256" title="Screenshot of notification">

## Requirements

The requirements are for the most recent version of the plugin. Previous
versions support older versions of gnome-shell.

* gnome-shell 3.30 or higher
* gjs 1.54 or higher

## Install

First clone the repo and run the following install instructions.

```
git clone -b develop git@github.com:BigE/desk-changer.git
cd desk-changer
make all
```

Once the make process is complete, you can then run `make install` to install
the extension to your local directory. If you want to install it to the
system, just copy the desk-changer&commat;eric.gach.gmail.com folder to your
`/usr/share/gnome-shell/extensions/` folder.

>\# cp -r desk-changer@eric.gach.gmail.com/ /usr/share/gnome-shell/extensions/

Then restart gnome-shell and enable the extension. Once it is enabled, you can
use the extension to start the daemon with the built in toggle switch.

## General Information
### Daemon

The daemon is now part of the extension itself and has no command line
interface. The only interface available to the daemon now is the DBus
interface.

#### DBUS Interface
**Name**: `org.gnome.Shell.Extensions.DeskChanger.Daemon`

**Path**: `/org/gnome/Shell/Extensions/DeskChanger/Daemon`

##### Methods
* `Load(String profile)` Loads the specified profile and respective locations
* `Next()` Switches to the next wallpaper, returns the uri
* `Prev()` Switches to the previous wallpaper, returns the uri
* `Quit()` Terminates the daemon process.
* `Start()` Enables automatic rotation and makes the daemon available
* `Stop([Boolean quit])` Disables automatic rotation and makes the daemon
  unavaialble for use. If `quit` is `true` then the daemon process will be
  terminated. 

##### Properties
* History - Read only array of history
* Preview - Read only URI of the next wallpaper
* Queue - Read only array of the queue
* Running - Read only boolean value if the daemon is stopped or started

##### Signals
* Changed - Emitted when the wallpaper is changed, uri to wallpaper file
* Preview - Emitted when a new preview is available, uri to preview file
* Running - Emitted when the daemon is stopped and started


### dconf-editor

To view the settings in dconf-editor, just use the `GSETTINGS_SCHEMA_DIR=`
environment variable to open dconf-editor with the extensions schema available
to the editor.

>$ GSETTINGS_SCHEMA_DIR=~/.local/share/gnome-shell/extensions/desk-changer@eric.gach.gmail.com/schemas/ dconf-editor /org/gnome/shell/extensions/desk-changer

Then navigate to `/org/gnome/shell/extensions/desk-changer` and you will see
all of the available settings for the extension and daemon.
