/**
 * Copyright (c) 2014-2018 Eric Gach <eric.gach@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Interface = Me.imports.daemon.interface;
const Utils = Me.imports.utils;

const Gettext = imports.gettext.domain('desk-changer');
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const _ = Gettext.gettext;

const DaemonProxy = Gio.DBusProxy.makeProxyWrapper(Interface.DBusInterface);

let DeskChangerPrefs = GObject.registerClass(
class DeskChangerPrefs extends GObject.Object {
    _init() {
        let notebook = new Gtk.Notebook(),
            settings = Convenience.getSettings(),
            daemon = new DaemonProxy(Gio.DBus.session, Interface.DBusName, Interface.DBusPath);

        this.box = new Gtk.Box({
            border_width: 10,
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
        });

        // init the pages
        this._init_profiles(notebook, settings);
        this._init_keyboard(notebook, settings);
        this._init_extension(notebook, settings);
        this._init_daemon(notebook, settings, daemon);

        this.box.pack_start(notebook, true, true, 0);
        this.box.show_all();
        super._init();
    }

    _init_daemon(notebook, settings, daemon) {
        let daemon_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL}),
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
            label = new Gtk.Label({label: _('DeskChanger Rotation Mode')}),
            combo_box_rotation = new Gtk.ComboBoxText(),
            spin_button_interval = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: 0.0,
                    upper: 84600.0,
                    step_increment: 1.0,
                    page_increment: 10.0,
                    page_size: 0.0
                })
            }),
            switch_auto_start = new Gtk.Switch(),
            switch_daemon = new Gtk.Switch(),
            switch_remember_profile_state = new Gtk.Switch(),
            text_buffer_allowed_mime_types = new Gtk.TextBuffer({text: settings.allowed_mime_types.join("\n")});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        combo_box_rotation.insert_text(0, 'interval');
        combo_box_rotation.insert_text(1, 'hourly');
        combo_box_rotation.insert_text(2, 'disabled');
        this._update_rotation(settings, combo_box_rotation);
        combo_box_rotation.connect('changed', (object) => {
            settings.rotation = object.get_active_text();
        });
        settings.connect('changed::rotation', () => {
            this._update_rotation(settings, combo_box_rotation);
        });
        box.pack_start(combo_box_rotation, false, false, 5);
        daemon_box.pack_start(box, false, false, 10);
        // Daemon Status
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('DeskChanger Daemon Status')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        Utils.debug(daemon.running);
        switch_daemon.set_active(daemon.running);
        switch_daemon.connect('notify::active', () => {
            if (switch_daemon.get_state() && !daemon.running) {
                daemon.Start();
            } else if (!switch_daemon.get_state() && daemon.running) {
                daemon.Stop();
            }
        });
        daemon.connectSignal('toggled', (running) => {
            switch_daemon.set_state(running);
        });
        box.pack_start(switch_daemon, false, false, 5);
        daemon_box.pack_start(box, false, false, 10);
        // Autostart
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('DeskChanger Autostart Daemon')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        switch_auto_start.set_active(settings.auto_start);
        switch_auto_start.connect('notify::active', () => {
            settings.auto_start = switch_auto_start.get_state();
        });
        box.pack_end(switch_auto_start, false, false, 5);
        daemon_box.pack_start(box, false, false, 10);
        // Remember profile state
        box = new Gtk.Box();
        label = new Gtk.Label({label: _('Remember the profiles current/next wallpaper')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        switch_remember_profile_state.set_active(settings.remember_profile_state);
        switch_remember_profile_state.connect('notify::active', () => {
            settings.remember_profile_state = switch_remember_profile_state.get_state();
        });
        box.pack_end(switch_remember_profile_state, false, false, 5);
        daemon_box.pack_start(box, false, false, 5);
        // Interval timer
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('Wallpaper Timer Interval (seconds)')});
        box.pack_start(label, false, true, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        spin_button_interval.set_value(settings.interval);
        spin_button_interval.update();
        box.pack_start(spin_button_interval, false, true, 5);
        let button = new Gtk.Button({label: 'Save'});
        button.connect('clicked', () => {
            settings.interval = spin_button_interval.get_value();
        });
        box.pack_end(button, false, false, 5);
        daemon_box.pack_start(box, false, false, 5);
        // Allowed Mime Types
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('Allowed Mime Types')});
        box.pack_start(label, false, true, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        let textview = new Gtk.TextView({
            buffer: text_buffer_allowed_mime_types,
            justification: Gtk.Justification.RIGHT,
        });
        box.pack_end(textview, false, true, 5);
        daemon_box.pack_start(box, false, false, 5);
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        button = new Gtk.Button({label: 'Save'});
        button.connect('clicked', () => {
            settings.allowed_mime_types = text_buffer_allowed_mime_types.text.split("\n");
        });
        box.pack_end(button, false, true, 5);
        daemon_box.pack_start(box, false, false, 5);
        notebook.append_page(daemon_box, new Gtk.Label({label: _('Daemon')}));
    }

    _init_extension(notebook, settings) {
        let extension_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL}),
            frame = new Gtk.Frame({label: _('Profile')}),
            frame_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL}),
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
            label = new Gtk.Label({label: _('Desktop Profile')}),
            current_profile = new Gtk.ComboBoxText(),
            update_lockscreen = new Gtk.Switch(),
            lockscreen_profile = new Gtk.ComboBoxText(),
            switch_icon_preview = new Gtk.Switch(),
            switch_notifications = new Gtk.Switch();

        // Profiles
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._load_profiles(current_profile, settings, settings.current_profile);
        current_profile.connect('changed', (object) => {
            if (this._is_init) {
                return;
            }

            settings.current_profile = object.get_active_text();
        });
        box.pack_start(current_profile, false, false, 5);
        frame_box.pack_start(box, false, false, 10);

        if (Convenience.checkShellVersion('3.35', '<')) {
            // Update Lockscreen Background
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
            label = new Gtk.Label({label: _('Update LockScreen Background')});
            box.pack_start(label, false, false, 5);
            label = new Gtk.Label({label: ' '});
            box.pack_start(label, true, true, 5);
            update_lockscreen.set_active(settings.update_lockscreen);
            update_lockscreen.connect('notify::active', () => {
                settings.update_lockscreen = update_lockscreen.get_state();
            });

            // Lockscreen Profile
            box.pack_start(update_lockscreen, false, false, 5);
            frame_box.pack_start(box, false, false, 10);
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
            label = new Gtk.Label({label: _('Lockscreen Profile')});
            box.pack_start(label, false, false, 5);
            label = new Gtk.Label({label: ' '});
            box.pack_start(label, true, true, 5);
            lockscreen_profile.connect('key-press-event', (widget, event) => {
                let keyval = event.get_keyval();
                if (keyval[0] && keyval[1] === Gdk.KEY_BackSpace) {
                    lockscreen_profile.set_active(-1);
                }
            });

            this._load_profiles(lockscreen_profile, settings, settings.lockscreen_profile);
            if (!settings.lockscreen_profile) {
                lockscreen_profile.set_active(-1);
            }
            lockscreen_profile.connect('changed', (object) => {
                settings.lockscreen_profile = object.get_active_text();
            });
            box.pack_start(lockscreen_profile, false, false, 5);
            frame_box.pack_start(box, false, false, 5);
        }

        frame.add(frame_box);
        extension_box.pack_start(frame, false, false, 10);

        // Preview as Icon
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('Show Preview as Icon')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        switch_icon_preview.set_active(settings.icon_preview);
        switch_icon_preview.connect('notify::active', () => {
            settings.icon_preview = switch_icon_preview.get_state();
        });
        box.pack_start(switch_icon_preview, false, false, 5);
        extension_box.pack_start(box, false, false, 5);

        // Notifications
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('Show Notifications')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        switch_notifications.set_active(settings.notifications);
        switch_notifications.connect('notify::active', () => {
            settings.notifications = switch_notifications.get_state();
        });
        box.pack_start(switch_notifications, false, false, 5);
        extension_box.pack_start(box, false, false, 5);
        notebook.append_page(extension_box, new Gtk.Label({label: _('Extension')}));
    }

    _init_keyboard(notebook, settings) {
        let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL}),
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
            model = new Gtk.ListStore(),
            cellrend = new Gtk.CellRendererText(),
            col = new Gtk.TreeViewColumn({title: _('Action'), expand: true}),
            treeview, row, key, mods;

        model.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT,
            GObject.TYPE_STRING,
        ]);
        treeview = new Gtk.TreeView({
            expand: true,
            model: model,
            margin: 4,
        });

        // next keybinding
        row = model.insert(-1);
        [key, mods] = Gtk.accelerator_parse(settings.getKeybinding('next-wallpaper'));
        model.set(row, [0, 1, 2, 3], [_('Next Wallpaper'), mods, key, 'next-wallpaper']);
        // prev keybinding
        row = model.insert(-1);
        [key, mods] = Gtk.accelerator_parse(settings.getKeybinding('prev-wallpaper'));
        model.set(row, [0, 1, 2, 3], [_('Previous Wallpaper'), mods, key, 'prev-wallpaper']);

        col.pack_start(cellrend, true);
        col.add_attribute(cellrend, 'text', 0);
        treeview.append_column(col);

        cellrend = new Gtk.CellRendererAccel({editable: true, 'accel-mode': Gtk.CellRendererAccelMode.GTK});
        cellrend.connect('accel-edited', (rend, iter, key, mods) => {
            let value = Gtk.accelrator_name(key, mods);
            if (this._keybindingExists(value)) {
                // keybinding exists error
            }

            let [success, iterator] = model.get_iter_from_string(iter);

            if (!success) {
                throw new Error(_('Failed to update keybinding'));
            }

            let name = model.get_value(iterator, 3);
            Utils.debug(`updating keybinding ${name} to ${value}`);
            model.set(iterator, [1, 2], [mods, key]);
            settings.setKeybinding(name, value);
        });
        cellrend.connect('accel-cleared', (rend, iter) => {
            let [success, iterator] = model.get_iter_from_string(iter);

            if (!success) {
                throw new Error(_('Failed to update keybinding'));
            }

            let name = model.get_value(iterator, 3);
            Utils.debug(`clearing keybinding ${name}`);
            model.set(iterator, [1, 2], [0, 0]);
            settings.setKeybinding(name, '');
        });

        col = new Gtk.TreeViewColumn({title: _('Modify')});
        col.pack_end(cellrend, false);
        col.add_attribute(cellrend, 'accel-mods', 1);
        col.add_attribute(cellrend, 'accel-key',  2);
        treeview.append_column(col);

        box.pack_start(treeview, true, true, 5);
        vbox.pack_start(box, false, true, 10);
        notebook.append_page(vbox, new Gtk.Label({label: _('Keyboard Shortcuts')}));
    }

    _init_profiles(notebook, settings) {
        let folders = new Gtk.ListStore(),
            profiles_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL}),
            hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
            label = new Gtk.Label({label: _('Profile')}),
            profiles_combo_box = new Gtk.ComboBoxText(),
            add_profile = new Gtk.Button({label: _('Add')}),
            remove_profile = new Gtk.Button({label: _('Remove')});

        // Profile dropdown
        add_profile.connect('clicked', () => {
            let dialog = new Gtk.Dialog(),
                mbox = dialog.get_content_area(),
                box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
                label = new Gtk.Label({label: _('Profile Name')}),
                input = new Gtk.Entry();
            box.pack_start(label, false, true, 10);
            box.pack_start(input, true, true, 10);
            box.show_all();
            mbox.pack_start(box, true, true, 10);
            dialog.add_button(_('OK'), Gtk.ResponseType.OK);
            dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            let result = dialog.run();
            if (result === Gtk.ResponseType.OK) {
                let _profiles = settings.profiles;
                _profiles[input.get_text()] = [];
                settings.profiles = _profiles;
                this._load_profiles(profiles_combo_box, settings, input.get_text());
            }
            dialog.destroy();
        });

        remove_profile.connect('clicked', () => {
            let profile, dialog, box, label;
            profile = profiles_combo_box.get_active_text();
            dialog = new Gtk.Dialog();
            box = dialog.get_content_area();
            label = new Gtk.Label({label: _('Are you sure you want to delete the profile "%s"?'.format(profile))});
            box.pack_start(label, true, true, 10);
            box.show_all();
            dialog.add_button(_('Yes'), Gtk.ResponseType.YES);
            dialog.add_button(_('No'), Gtk.ResponseType.NO);
            let response = dialog.run();
            if (response == Gtk.ResponseType.YES) {
                let _profiles = settings.profiles;
                delete _profiles[profile];
                settings.profiles = _profiles;
                this._load_profiles(profiles_combo_box, settings, settings.current_profile);
            }
            dialog.destroy();
        });

        folders.set_column_types([GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]);
        profiles_combo_box.connect('changed', (instance) => {
            for (let profile in settings.profiles) {
                if (profile === instance.get_active_text()) {
                    folders.clear();

                    for (let folder in settings.profiles[profile]) {
                        folder = [settings.profiles[profile][folder][0], settings.profiles[profile][folder][1]];
                        folders.insert_with_valuesv(-1, [0, 1], folder);
                    }

                    break;
                }
            }
        });

        this._load_profiles(profiles_combo_box, settings);

        hbox.pack_start(label, false, false, 10);
        hbox.pack_start(profiles_combo_box, true, true, 10);
        hbox.pack_start(add_profile, false, false, 0);
        hbox.pack_start(remove_profile, false, false, 0);
        profiles_box.pack_start(hbox, false, false, 10);

        // Treeview for profile folders
        let profiles = new Gtk.TreeView(),
            renderer = new Gtk.CellRendererText(),
            column = new Gtk.TreeViewColumn({title: _('Uri'), expand: true});

        profiles.get_selection().set_mode(Gtk.SelectionMode.SINGLE);
        profiles.set_model(folders);
        renderer.set_property('editable', true);
        renderer.connect('edited', (renderer, path, new_text) => {
            let [bool, iter] = folders.get_iter_from_string(path);
            folders.set_value(iter, 0, new_text);
            this._save_profile(profiles_combo_box.get_active_text(), folders, settings);
            profiles_combo_box.do_changed();
        });
        column.pack_start(renderer, true);
        column.add_attribute(renderer, 'text', 0);
        profiles.append_column(column);

        renderer = new Gtk.CellRendererToggle();
        renderer.connect('toggled', (widget, path) => {
            let iter = folders.get_iter_from_string(path)[1],
                _profiles = settings.profiles;
            folders.set_value(iter, 1, !folders.get_value(iter, 1));
            _profiles[profiles_combo_box.get_active_text()][path][1] = Boolean(folders.get_value(iter, 1));
            settings.profiles = _profiles;
            this._load_profiles(profiles_combo_box, settings);
        });
        column = new Gtk.TreeViewColumn({title: _('Sub Folders'), expand: false});
        column.pack_start(renderer, false);
        column.add_attribute(renderer, 'active', 1);
        profiles.append_column(column);
        profiles_box.pack_start(profiles, true, true, 10);

        // Add/Remove URI buttons
        let remove = new Gtk.Button({label: _('Remove')}),
            add = new Gtk.Button({label: _('Add Image')});

        remove.connect('clicked', () => {
            let [bool, list, iter] = profiles.get_selection().get_selected(),
                path = list.get_path(iter),
                _profiles = settings.profiles;
            _profiles[profiles_combo_box.get_active_text()].splice(path.get_indices(), 1);
            settings.profiles = _profiles;
            remove.set_sensitive(false);
        });
        remove.set_sensitive(false);

        add.connect('clicked', () => {
            this._add_item(_('Add Image'), Gtk.FileChooserAction.OPEN, profiles_combo_box, settings);
        });

        profiles.connect('cursor_changed', () => {
            remove.set_sensitive(true);
        });

        hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        hbox.pack_start(add, false, true, 10);

        add = new Gtk.Button({label: _('Add Folder')});
        add.connect('clicked', () => {
            this._add_item(_('Add Folder'), Gtk.FileChooserAction.SELECT_FOLDER, profiles_combo_box, settings);
        });

        hbox.pack_start(add, false, true, 10);
        hbox.pack_start(new Gtk.Label({label: ' '}), true, true, 0);
        hbox.pack_start(remove, false, true, 10);
        profiles_box.pack_start(hbox, false, true, 10);

        notebook.append_page(profiles_box, new Gtk.Label({label: _('Profiles')}));
    }


    _add_item(title, action, combo_box, settings) {
        let dialog, filter_image, response;
        dialog = new Gtk.FileChooserDialog({title: title, action: action});
        if (action != Gtk.FileChooserAction.SELECT_FOLDER) {
            filter_image = new Gtk.FileFilter();
            filter_image.set_name("Image files");
            filter_image.add_mime_type("image/*");
            dialog.add_filter(filter_image);
        }
        dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        dialog.add_button(Gtk.STOCK_OPEN, Gtk.ResponseType.OK);
        dialog.set_select_multiple(true);
        response = dialog.run();
        if (response === Gtk.ResponseType.OK) {
            let paths = dialog.get_uris(), profile, profiles = settings.profiles;
            profile = combo_box.get_active_text();
            for (let path in paths) {
                profiles[profile].push([paths[path], false]);
            }
            settings.profiles = profiles;
            this._load_profiles(combo_box, settings);
        }
        dialog.destroy();
    }

    _load_profiles(combo_box, settings, text=null) {
        let active = combo_box.get_active(),
            i = 0;

        if (!text) {
            text = combo_box.get_active_text();
        }

        combo_box.remove_all();

        for (let profile in settings.profiles) {
            combo_box.insert_text(i, profile);

            if (text === profile || (active === -1 && profile === settings.current_profile)) {
                combo_box.set_active(i);
            }

            i++;
        }
    }

    _save_profile(profile, folders, settings) {
        let _profile = [],
            profiles = settings.profiles;

        folders.foreach((model, path, iter) => {
            _profile.push([model.get_value(iter, 0), model.get_value(iter, 1)]);
        });

        profiles[profile] = _profile;
        settings.profiles = profiles;
    }

    _update_rotation(settings, combo_box) {
        switch (settings.rotation) { 
            case 'interval':
                combo_box.set_active(0);
                break;
            case 'hourly':
                combo_box.set_active(1);
                break;
            default:
                combo_box.set_active(2);
                break;
        }
    }
}
);

function buildPrefsWidget() {
    let widget = new DeskChangerPrefs();
    return widget.box;
}

function init() {
    Utils.debug('init');
}
