# desk-changer

Gnome-Shell wallpaper slideshow extension with multiple profile support. The extension allows you to switch profiles
on the fly without reloading the daemon.

---

### Screenshots

![Screenshot-1](./screenshot-1.png?raw=true "Screenshot of menu")
![Screenshot-2](./screenshot-2.png?raw=true "Screenshot of notification")

---

## Requirements

* gnome-shell 3.8 or higher
* Python 2 or 3 with [PyGObject](https://wiki.gnome.org/action/show/Projects/PyGObject?action=show&redirect=PyGObject)

### Install

Just simply copy the desk-changer&commat;eric.gach.gmail.com folder to your `~/.local/share/gnome-shell/extensions/` folder or the
system `/usr/share/gnome-shell/extensions/` folder.

`cp -r desk-changer@eric.gach.gmail.com/ ~/.local/share/gnome-shell/extensions/`

or

`cp -r desk-changer@eric.gach.gmail.com/ /usr/share/gnome-shell/extensions/`

Then restart gnome-shell and enable the extension. Once it is enabled, you can use the extension to start the daemon
with the built in toggle switch.

---

### Daemon

The daemon is simply a Gio.Application running as a service. To view more information about the daemon, run it from the command line with the `-h` or `--help` option.

>$ ./desk-changer-daemon.py -h  
>Usage:
>  desk-changer-daemon.py [OPTION...]
>
>Help Options:
>  -h, --help                Show help options
>  --help-all                Show all help options
>
