NAME=desk-changer
DOMAIN=eric.gach.gmail.com
UUID=$(NAME)@$(DOMAIN)
VERSION=36

.PHONY: yarn_install

ifeq ($(strip $(DESTDIR)),)
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif

all: dist/extension.js

.yarn/install-state.gz:
	@yarn install

dist/extension.js dist/prefs.js: .yarn/install-state.gz
	@yarn tsc

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	@glib-compile-schemas schemas

dist/org.gnome.shell.extensions.$(NAME).gresource: resources/org.gnome.shell.extensions.desk-changer.gresource.xml
	@glib-compile-resources \
		--target=./dist/org.gnome.shell.extensions.desk-changer.gresource \
		--sourcedir=./resources \
		./resources/org.gnome.shell.extensions.desk-changer.gresource.xml

dist: dist/extension.js dist/prefs.js schemas/gschemas.compiled dist/org.gnome.shell.extensions.$(NAME).gresource
	@cp -r schemas dist
	@cp -r metadata.json dist

$(UUID).zip: dist
	@(cd dist && zip ../$(UUID).zip -9r .)

pack: $(UUID).zip

install: $(UUID).zip
	@touch $(INSTALLBASE)/$(UUID)
	@rm -Rf $(INSTALLBASE)/$(UUID)
	@mv dist $(INSTALLBASE)/$(UUID)

clean:
	@rm -Rf dist $(UUID).zip .yarn/install-state.gz

pot:
	@xgettext --package-name=DeskChanger --package-version=$(VERSION) -k --keyword=_ -o ./po/desk-changer.pot -D ./ $(UUID)/_deskchanger.js $(UUID)/convenience.js $(UUID)/extension.js $(UUID)/prefs.js $(UUID)/service.js $(UUID)/common/utils.js $(UUID)/daemon/interface.js $(UUID)/daemon/profile.js $(UUID)/daemon/server.js $(UUID)/daemon/timer.js $(UUID)/ui/control.js $(UUID)/ui/panelMenu.js $(UUID)/ui/popupMenu.js resources/ui/prefs.ui resources/ui/rotation.ui

update-translation: all
	@(cd po && ./compile.sh ../desk-changer@eric.gach.gmail.com/locale)
