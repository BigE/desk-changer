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

There are some dependencies needed to install the extension from source.
 
  * vala
  * gnome-common
  * autoconf
  * automake
 
 Run the `./autogen.sh` script to configure the project, then run `make local-install` to build and
install the extension locally. Restart gnome-shell and enable the extension. Once it is enabled, you can use the
extension to start the daemon with the built in toggle switch.

---

### Daemon

The daemon is now written in vala and must be compiled for the extension to work.
