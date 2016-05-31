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

To view more information about the daemon, run it from the command line with the `-h` or `--help` option.

>$ ./desk-changer@eric.gach.gmail.com/daemon.py -h  
>usage: daemon.py \[-h] \[--logfile LOGFILE] \[--logformat FORMAT] \[--loglevel {DEBUG,INFO,WARNING,ERROR,CRITICAL}]
>                 \[-v] \[--version] {start,stop,restart,status}  
>  
>DeskChanger Daemon  
>  
>positional arguments:  
>  {start,stop,restart,status}  
>                        Control the daemon process or check the status.  
>  
>optional arguments:  
>  -h, --help            show this help message and exit  
>  --logfile LOGFILE     Log file to output logging to, default: ./desk-changer@eric.gach.gmail.com/daemon.log  
>  --logformat FORMAT    Change the logging format  
>  --loglevel {DEBUG,INFO,WARNING,ERROR,CRITICAL}
>                        Set the default logging level  
>  -v, --verbose         Display logging output to stderr  
>  --version             show program's version number and exit  
