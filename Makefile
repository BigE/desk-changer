UUID = desk-changer@eric.gach.gmail.com

ifeq ($(strip $(DESTDIR)),)
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif

all: compile-resources, compile-schemas

compile-resources:
	glib-compile-resources --sourcedir=./$(UUID)/resources ./$(UUID)/resources/org.gnome.Shell.Extensions.DeskChanger.gresource.xml

compile-schemas:
	glib-compile-schemas ./$(UUID)/schemas/

install: update-translation
	mkdir -p $(INSTALLBASE)
	cp -R $(UUID)/ $(INSTALLBASE)/
	echo done

pot:
	xgettext --package-name=DeskChanger --package-version=29 -k --keyword=_ -o ./po/desk-changer.pot -D ./$(UUID)/ _deskchanger.js convenience.js extension.js prefs.js service.js common/utils.js daemon/interface.js daemon/profile.js daemon/server.js daemon/timer.js ui/control.js ui/panelMenu.js ui/popupMenu.js

update-translation: all
	cd po; \
	./compile.sh ../desk-changer@eric.gach.gmail.com/locale;
