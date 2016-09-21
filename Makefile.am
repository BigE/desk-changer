# The actual runnable program is set to the SCRIPTS primitive.
# # Prefix bin_ tells where to copy this
ACLOCAL_AMFLAGS = -I m4 ${ACLOCAL_FLAGS}

uuid = desk-changer@eric.gach.gmail.com
localprefix = $(HOME)/.local/share/gnome-shell/extensions
extensiondir = $(datadir)/gnome-shell/extensions/$(uuid)

@GSETTINGS_RULES@

dist_extension_DATA = extension.js desk-changer-daemon daemon.js metadata.json prefs.js settings.js utils.js
gsettings_SCHEMAS = org.gnome.shell.extensions.desk-changer.gschema.xml

EXTRA_DIST = $(gsettings_SCHEMAS)

zip-file: all
	rm -fR $(builddir)/_build
	rm -fR $(builddir)/zip-file
	$(MKDIR_P) $(builddir)/_build; \
	$(MKDIR_P) $(builddir)/zip-file; \
	$(MAKE) install DESTDIR="$(abs_builddir)/_build"; \
	cp -r "$(builddir)/_build$(datadir)/gnome-shell/extensions/$(uuid)" "$(builddir)/_build"; \
	if [ -f "$(builddir)/_build$(datadir)/glib-2.0/schemas/org.gnome.shell.extensions.desk-changer.gschema.xml" ]; then \
		$(MKDIR_P) "$(builddir)/_build/$(uuid)/schemas"; \
		mv "$(builddir)/_build$(datadir)/glib-2.0/schemas/org.gnome.shell.extensions.desk-changer.gschema.xml" "$(builddir)/_build/$(uuid)/schemas"; \
		glib-compile-schemas "$(builddir)/_build/$(uuid)/schemas"; \
	fi; \
	(cd "$(builddir)/_build/$(uuid)/"; \
	 zip -qr "$(abs_builddir)/zip-file/desk-changer.shell-extension.zip" .; \
	); \
	rm -fR $(builddir)/_build

local-install: zip-file
	zip_file="$(abs_builddir)/zip-file/desk-changer.shell-extension.zip"; \
	if [ -d "$(localprefix)/$(uuid)" ]; then \
	rm -fR "$(localprefix)/$(uuid)"; \
	fi; \
	$(MKDIR_P) $(localprefix)/$(uuid); \
	(cd $(localprefix)/$(uuid); \
	unzip -q $${zip_file}; \
	chmod +x desk-changer-daemon);

install-data-hook:
	cd $(DESTDIR)$(extensiondir) && chmod +x desk-changer-daemon

noinst_PROGRAMS = desk-changer-daemon
desk_changer_daemon_CFLAGS=$(glib_CFLAGS) $(jsonglib_CFLAGS)
desk_changer_daemon_LDADD=$(glib_LIBS) $(jsonglib_LIBS)
desk_changer_daemon_VALAFLAGS = --pkg gio-2.0 --pkg json-glib-1.0
desk_changer_daemon_SOURCES = daemon.vala

