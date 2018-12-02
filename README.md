# desk-changer

Gnome-Shell wallpaper slideshow extension with multiple profile support. The extension allows you to switch profiles
on the fly without reloading the daemon.

## Screenshots

<img src="./screenshot-1.png?raw=true" width="256" title="Screenshot of menu"> <img src="./screenshot-2.png?raw=true" width="256" title="Screenshot of notification">

## Requirements

* gnome-shell 3.8 or higher

## Install

Just simply copy the desk-changer&commat;eric.gach.gmail.com folder to your `~/.local/share/gnome-shell/extensions/`
folder or the system `/usr/share/gnome-shell/extensions/` folder.

>$ cp -r desk-changer@eric.gach.gmail.com/ ~/.local/share/gnome-shell/extensions/

or

>\# cp -r desk-changer@eric.gach.gmail.com/ /usr/share/gnome-shell/extensions/

Then restart gnome-shell and enable the extension. Once it is enabled, you can use the extension to start the daemon
with the built in toggle switch.

## General Information
### Daemon

The daemon is now part of the extension itself and has no command line interface. The only interface available to the
daemon now is the DBus interface

#### DBUS Interface
**Name**: org.gnome.Shell.Extensions.DeskChanger.Daemon

**Path**: /org/gnome/Shell/Extensions/DeskChanger/Daemon

##### Methods
* LoadProfile(String profile) - Loads the specified profile
* Next() - Moves to the next wallpaper, returns the uri
* Prev() - Moves to the previous wallpaper, returns the uri
* Start() - Starts the daemon
* Stop() - Stops the daemon

##### Properties
* history - Read only array of history
* queue - Read only array of the queue
* lockscreen - writable boolean value if the lockscreen is active

##### Signals
* changed - Emitted when the wallpaper is changed, uri to wallpaper file
* error - _Not implemented_
* preview - Emitted when a new preview is available, uri to preview file


### dconf-editor

To view the settings in dconf-editor, just use the `GSETTINGS_SCHEMA_DIR=` environment variable to open dconf-editor
with the extensions schema available to the editor.

>$ GSETTINGS_SCHEMA_DIR=~/.local/share/gnome-shell/extensions/desk-changer@eric.gach.gmail.com/schemas/ dconf-editor`

Then navigate to `org.gnome.shell.extensions.desk-changer` and you will see all of the available settings for the
extension and daemon.

