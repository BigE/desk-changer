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

The daemon is now written in vala and must be compiled for the extension to work.
