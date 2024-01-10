UUID = desk-changer@eric.gach.gmail.com
VERSION = 35

ifeq ($(strip $(DESTDIR)),)
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif

all: convert-glade-to-ui compile-resources compile-schemas

compile-resources:
	glib-compile-resources \
		--target=./$(UUID)/resources/org.gnome.Shell.Extensions.DeskChanger.gresource \
		--sourcedir=./resources \
		./resources/org.gnome.Shell.Extensions.DeskChanger.gresource.xml

compile-schemas:
	glib-compile-schemas ./$(UUID)/schemas/

convert-glade-to-ui:
	gtk4-builder-tool simplify --3to4 ./resources/ui/rotation.glade > ./resources/ui/rotation.ui
	gtk4-builder-tool simplify --3to4 ./resources/ui/prefs/about.glade > ./resources/ui/prefs/about.ui
	gtk4-builder-tool simplify --3to4 ./resources/ui/prefs/daemon.glade > ./resources/ui/prefs/daemon.ui
	gtk4-builder-tool simplify --3to4 ./resources/ui/prefs/extension.glade > ./resources/ui/prefs/extension.ui
	gtk4-builder-tool simplify --3to4 ./resources/ui/prefs/keyboard.glade > ./resources/ui/prefs/keyboard.ui
	gtk4-builder-tool simplify --3to4 ./resources/ui/prefs/profiles.glade > ./resources/ui/prefs/profiles.ui

install: update-translation
	mkdir -p $(INSTALLBASE)
	cp -R $(UUID)/ $(INSTALLBASE)/
	echo done

pot:
	xgettext --package-name=DeskChanger --package-version=$(VERSION) -k --keyword=_ -o ./po/desk-changer.pot -D ./ $(UUID)/_deskchanger.js $(UUID)/convenience.js $(UUID)/extension.js $(UUID)/prefs.js $(UUID)/service.js $(UUID)/common/utils.js $(UUID)/daemon/interface.js $(UUID)/daemon/profile.js $(UUID)/daemon/server.js $(UUID)/daemon/timer.js $(UUID)/ui/control.js $(UUID)/ui/panelMenu.js $(UUID)/ui/popupMenu.js resources/ui/prefs.ui resources/ui/rotation.ui

update-translation: all
	cd po; \
	./compile.sh ../desk-changer@eric.gach.gmail.com/locale;

zipfile: all
	cd ./$(UUID)/; \
	zip -r ../$(UUID)-$(VERSION).zip . -x 'resources/ui/*' -x 'resources/icons/*' -x 'resources/*.xml' -x 'resources/*.in' -x '*.gitkeep'
