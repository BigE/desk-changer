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

update-translation: all
	cd po; \
	./compile.sh ../desk-changer@eric.gach.gmail.com/locale;