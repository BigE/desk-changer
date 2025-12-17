NAME := desk-changer
DOMAIN := eric.gach.gmail.com
UUID := $(NAME)@$(DOMAIN)
EXT_DIR := "${HOME}/.local/share/gnome-shell/extensions"
TARGET_DIR := $(EXT_DIR)/$(UUID)
VERSION := version-$(shell grep '"version"' metadata.json | cut -d '"' -f 4)

.PHONY: all pack install clean pot symlink update-translation

all: schemas/gschemas.compiled dist update-translations

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

dist: dist/extension.js dist/prefs.js dist/org.gnome.shell.extensions.$(NAME).gresource
	@cp -r schemas dist
	@cp -r metadata.json dist
	@yarn eslint dist --fix

$(UUID)-$(VERSION).zip: dist
	@(cd dist && zip ../$(UUID)-$(VERSION).zip -9r .)

pack: $(UUID)-$(VERSION).zip

install: pack
	@echo "Installing $(UUID)"
	@gnome-extensions install $(UUID)-$(VERSION).zip
	@echo "Extension is installed. You must logout/login before it can be enabled."

clean:
	@rm -Rf dist $(UUID)-$(VERSION).zip .yarn/install-state.gz schemas/gschemas.compiled

pot: po/xgettext.txt
	@xgettext \
		--package-name=$(NAME) \
		--package-version=$(VERSION) \
		-k --keyword=_ --keyword=gettext \
		-o ./po/desk-changer.pot \
		-f ./po/xgettext.txt

po/desk-changer.pot: pot

symlink: schemas/gschemas.compiled dist
#	Ensure the target doesn't exist as an actual directory
	@if [ -d "$(TARGET_DIR)" ] && [ ! -L "$(TARGET_DIR)" ]; then \
		echo "Error: $(TARGET_DIR) exists and is a real directory" \
		echo "Please remove it manually to prevent data loss."; \
		exit 1; \
	fi

	@echo "Creating symlink in $(EXT_DIR)"
	@ln -sfn "$(PWD)/dist" "$(TARGET_DIR)"

uninstall:
	@echo "Uninstalling $(UUID)"
	@gnome-extensions uninstall $(UUID)

unsymlink:
	@echo "Removing symlink from $(EXT_DIR)"
#	This should fail if the extension is not a symlink since we're not passing the recursive flag.
	@rm -f $(TARGET_DIR)

update-translations: po/desk-changer.pot dist
	@(cd po && ./compile.sh ../dist/locale)

