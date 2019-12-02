UUID = desk-changer@eric.gach.gmail.com

ifeq ($(strip $(DESTDIR)),)
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif

all: compile-schemas

compile-schemas:
	glib-compile-schemas ./$(UUID)/schemas/

install: update-translation
	mkdir -p $(INSTALLBASE)
	cp -R $(UUID)/ $(INSTALLBASE)/
	echo done

pot:
	xgettext --package-name=DeskChanger --package-version=28 -k --keyword=_ -o ./po/desk-changer.pot -D ./$(UUID)/ extension.js prefs.js daemon/interface.js daemon/profile.js daemon/server.js daemon/timer.js ui/control.js ui/panelMenu.js ui/popupMenu.js

update-translation: all
	cd po; \
	./compile.sh ../desk-changer@eric.gach.gmail.com/locale;
