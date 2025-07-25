NAME=desk-changer
DOMAIN=eric.gach.gmail.com
UUID=$(NAME)@$(DOMAIN)
VERSION=37

ifeq ($(strip $(DESTDIR)),)
	INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALL_DIR = $(DESTDIR)/share/gnome-shell/extensions
endif

.PHONY: all pack install clean pot update-translation

all: dist/extension.js update-translations

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

install: dist
	@touch $(INSTALL_DIR)/$(UUID)
	@rm -Rf $(INSTALL_DIR)/$(UUID)
	@cp -r dist $(INSTALL_DIR)/$(UUID)

clean:
	@rm -Rf dist $(UUID).zip .yarn/install-state.gz

pot: po/xgettext.txt
	@xgettext --package-name=$(NAME) --package-version=$(VERSION) -k --keyword=_ --keyword=gettext -o ./po/desk-changer.pot -f ./po/xgettext.txt

po/desk-changer.pot: pot

update-translations: po/desk-changer.pot dist
	@(cd po && ./compile.sh ../dist/locale)

