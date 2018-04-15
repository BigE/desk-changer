/**
 * Copyright (c) 2014-2015 Eric Gach <eric@php-oop.net>
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
const Gdk = imports.gi.Gdk;
const Gettext = imports.gettext.domain('desk-changer');
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const _ = Gettext.gettext;

const DeskChangerSettings = Me.imports.settings.DeskChangerSettings;
const DeskChangerDaemon = Me.imports.daemon.DeskChangerDaemon;
const debug = Me.imports.utils.debug;

const DeskChangerPrefs = new Lang.Class({
    Name: 'DeskChangerPrefs',

    _init: function () {
        this._is_init = true;
        this._settings = new DeskChangerSettings();
        this._daemon = new DeskChangerDaemon(this._settings);
        this.box = new Gtk.Box({
            border_width: 10,
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });

        // init settings holders
        this._settingsKeybind = new Array();

        this.notebook = new Gtk.Notebook();
        this._initProfiles();
        this._initKeyboard();
        this._initExtension();
        this._initDaemon();
        this._load_profiles();
        this.box.pack_start(this.notebook, true, true, 0);
        this.box.show_all();
        this._is_init = false;
    },

    toggle_subfolders: function (widget, path) {
        let iter = this._folders.get_iter_from_string(path)[1];
        this._folders.set_value(iter, 1, !this._folders.get_value(iter, 1));
        let profiles = this._settings.profiles;
        profiles[this.profiles_combo_box.get_active_text()][path][1] = Boolean(this._folders.get_value(iter, 1));
        this._settings.profiles = profiles;
        this._load_profiles();
    },

    _initDaemon: function () {
        let daemon_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        // Rotation Mode
        let box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        let label = new Gtk.Label({label: 'DeskChanger Rotation Mode'});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._rotation_combo_box = new Gtk.ComboBoxText();
        box.pack_start(this._rotation_combo_box, false, false, 5);
        this._rotation_combo_box.insert_text(0, 'interval');
        this._rotation_combo_box.insert_text(1, 'hourly');
        this._rotation_combo_box.insert_text(2, 'disabled');
        this._update_rotation();
        this._rotation_combo_box.connect('changed', Lang.bind(this, function (object) {
            this._settings.rotation = object.get_active_text();
        }));
        this._settings.connect('changed::rotation', Lang.bind(this, function () {
            this._update_rotation();
        }));
        daemon_box.pack_start(box, false, false, 10);
        // Daemon Status
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('DeskChanger Daemon Status')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._switchDaemon = new Gtk.Switch();
        this._switchDaemon.set_active(this._daemon.is_running);
        this._switch_handler = this._switchDaemon.connect('notify::active', Lang.bind(this._daemon, this._daemon.toggle));
        this._daemon.connect('toggled', Lang.bind(this, function (obj, state, pid) {
            if (this._switch_handler) {
                this._switchDaemon.disconnect(this._switch_handler);
                this._switch_handler = null;
            }
            debug('toggled(' + state + ', ' + pid + ')');
            this._switchDaemon.set_active(state);
            this._switch_handler = this._switchDaemon.connect('notify::active', Lang.bind(this._daemon, this._daemon.toggle));
        }));
        box.pack_start(this._switchDaemon, false, false, 5);
        daemon_box.pack_start(box, false, false, 10);
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('DeskChanger Autostart Daemon')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._switchAutoStart = new Gtk.Switch();
        this._switchAutoStart.set_active(this._settings.auto_start);
        this._switchAutoStart.connect('notify::active', Lang.bind(this, function() {
            this._settings.auto_start = this._switchAutoStart.get_state();
        }));
        box.pack_end(this._switchAutoStart, false, false, 5);
        daemon_box.pack_start(box, false, false, 10);
        // Remember profile state
        box = new Gtk.Box();
        label = new Gtk.Label({label: _('Remember the profiles current/next wallpaper')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._switchRememberProfileState = new Gtk.Switch();
        this._switchRememberProfileState.set_active(this._settings.remember_profile_state);
        this._switchRememberProfileState.connect('notify::active', Lang.bind(this, function () {
            this._settings.remember_profile_state = this._switchRememberProfileState.get_state();
        }));
        box.pack_end(this._switchRememberProfileState, false, false, 5);
        daemon_box.pack_start(box, false, false, 5);
        // Interval timer
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('Wallpaper Timer Interval (seconds)')});
        box.pack_start(label, false, true, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._interval = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 84600.0,
                step_increment: 1.0,
                page_increment: 10.0,
                page_size: 0.0
            })
        });
        this._interval.set_value(this._settings.interval);
        this._interval.update();
        box.pack_start(this._interval, false, true, 5);
        let button = new Gtk.Button({label: 'Save'});
        button.connect('clicked', Lang.bind(this, function () {
            this._settings.interval = this._interval.get_value();
        }));
        box.pack_end(button, false, false, 5);
        daemon_box.pack_start(box, false, false, 5);
        this.notebook.append_page(daemon_box, new Gtk.Label({label: _('Daemon')}));
    },

    _initExtension: function () {
        let extension_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        let frame = new Gtk.Frame({label: _('Profile')});
        let frame_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        let box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        let label = new Gtk.Label({label: _('Desktop Profile')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._currentProfile = new Gtk.ComboBoxText();
        this._currentProfile.connect('changed', Lang.bind(this, function (object) {
            if (!this._is_init) {
                this._settings.current_profile = object.get_active_text();
            }
        }));
        box.pack_start(this._currentProfile, false, false, 5);
        frame_box.pack_start(box, false, false, 10);
        // TODO: can't use Main... leaving this for now
        // if (Main.screenShield) {
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
            label = new Gtk.Label({label: _('Update LockScreen Background')});
            box.pack_start(label, false, false, 5);
            label = new Gtk.Label({label: ' '});
            box.pack_start(label, true, true, 5);
            this._updateLockscreen = new Gtk.Switch();
            this._updateLockscreen.set_active(this._settings.update_lockscreen);
            this._updateLockscreen.connect('notify::active', Lang.bind(this, function () {
                this._settings.update_lockscreen = this._updateLockscreen.get_state();
            }));
            box.pack_end(this._updateLockscreen, false, false, 5);
            frame_box.pack_start(box, false, false, 10);
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
            label = new Gtk.Label({label: _('Lockscreen Profile')});
            box.pack_start(label, false, false, 5);
            label = new Gtk.Label({label: ' '});
            box.pack_start(label, true, true, 5);
            this._lockscreenProfile = new Gtk.ComboBoxText();
            this._lockscreenProfile.connect('key-press-event', Lang.bind(this, function (widget, event) {
                let keyval = event.get_keyval();
                if (keyval[0] && keyval[1] === Gdk.KEY_BackSpace) {
                    this._lockscreenProfile.set_active(-1);
                }
            }));
            this._lockscreenProfile.connect('changed', Lang.bind(this, function (object) {
                if (!this._is_init) {
                    this._settings.lockscreen_profile = object.get_active_text();
                }
            }));
            box.pack_start(this._lockscreenProfile, false, false, 5);
            frame_box.pack_start(box, false, false, 10);
        // }
        frame.add(frame_box);
        extension_box.pack_start(frame, false, false, 10);
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('Show Preview as Icon')});
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._switchIconPreview = new Gtk.Switch();
        this._switchIconPreview.set_active(this._settings.icon_preview);
        this._switchIconPreview.connect('notify::active', Lang.bind(this, function() {
            this._settings.icon_preview = this._switchIconPreview.get_state();
        }));
        box.pack_end(this._switchIconPreview, false, false, 5);
        extension_box.pack_start(box, false, false, 5);
        box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        label = new Gtk.Label({label: _('Show Notifications')})
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._switchNotifications = new Gtk.Switch();
        this._switchNotifications.set_active(this._settings.notifications);
        this._switchNotifications.connect('notify::active', Lang.bind(this, function() {
            this._settings.notifications = this._switchNotifications.get_state();
        }));
        box.pack_end(this._switchNotifications, false, false, 5);
        extension_box.pack_start(box, false, false, 5);
        // Integrate extension into the system menu
        box = new Gtk.Box();
        label = new Gtk.Label({label: _('Integrate extension in system menu')})
        box.pack_start(label, false, false, 5);
        label = new Gtk.Label({label: ' '});
        box.pack_start(label, true, true, 5);
        this._switchIntegrateSystemMenu = new Gtk.Switch();
        this._switchIntegrateSystemMenu.set_active(this._settings.integrate_system_menu);
        this._switchIntegrateSystemMenu.connect('notify::active', Lang.bind(this, function () {
            this._settings.integrate_system_menu = this._switchIntegrateSystemMenu.get_state();
        }));
        box.pack_end(this._switchIntegrateSystemMenu, false, false, 5);
        extension_box.pack_start(box, false, false, 5);
        this.notebook.append_page(extension_box, new Gtk.Label({label: 'Extension'}));
    },

    _initKeyboard: function () {
        let keyboard_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        let box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        // Create the storage for the keybindings
        let name, model = new Gtk.ListStore();
        model.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT,
            GObject.TYPE_STRING
        ]);

        let row = model.insert(-1);
        let [key, mods] = Gtk.accelerator_parse(this._settings.getKeybinding('next-wallpaper')[0]);
        model.set(row, [0, 1, 2, 3], [_('Next Wallpaper'), mods, key, 'next-wallpaper']);
        row = model.insert(-1);
        [key, mods] = Gtk.accelerator_parse(this._settings.getKeybinding('prev-wallpaper')[0]);
        model.set(row, [0, 1, 2, 3], [_('Previous Wallpaper'), mods, key, 'prev-wallpaper']);

        // create the treeview to display keybindings
        let treeview = new Gtk.TreeView({
            expand: true,
            model: model,
            margin: 4
        });

        // Action text column
        let cellrend = new Gtk.CellRendererText();
        let col = new Gtk.TreeViewColumn({title: _('Action'), expand: true});
        col.pack_start(cellrend, true);
        col.add_attribute(cellrend, 'text', 0);
        treeview.append_column(col);

        // keybinding column
        cellrend = new Gtk.CellRendererAccel({editable: true, 'accel-mode': Gtk.CellRendererAccelMode.GTK});
        cellrend.connect('accel-edited', Lang.bind(this, function (rend, iter, key, mods) {
            let value = Gtk.accelerator_name(key, mods);
            if (this._keybindingExists(value)) {
                // don't set the keybinding, it exists
                let dialog = new Gtk.MessageDialog({
                    buttons: Gtk.ButtonsType.OK,
                    message_type: Gtk.MessageType.ERROR,
                    text: _('The keybinding %s is already in use'.format(value))
                });
                dialog.run();
                dialog.destroy();
                return;
            }

            let [success, iterator] = model.get_iter_from_string(iter);

            if (!success) {
                throw new Error(_('Failed to update keybinding'));
            }

            let name = model.get_value(iterator, 3);
            debug('updating keybinding ' + name + ' to ' + value);
            model.set(iterator, [1, 2], [mods, key]);
            this._settings.setKeybinding(name, [value]);
        }));
        cellrend.connect('accel-cleared', Lang.bind(this, function (rend, iter) {
            let [success, iterator] = model.get_iter_from_string(iter);

            if (!success) {
                throw new Error(_('Failed to update keybinding'));
            }

            let name = model.get_value(iterator, 3);
            debug('clearing keybinding ' + name);
            model.set(iterator, [1,2], [0,0]);
            this._settings.setKeybinding(name, ['']);
        }));
        col = new Gtk.TreeViewColumn({title: _('Modify')});
        col.pack_end(cellrend, false);
        col.add_attribute(cellrend, 'accel-mods', 1);
        col.add_attribute(cellrend, 'accel-key', 2);
        treeview.append_column(col);

        box.pack_start(treeview, true, true, 5);
        keyboard_box.pack_start(box, false, true, 10);
        this.notebook.append_page(keyboard_box, new Gtk.Label({label: _('Keyboard Shortcuts')}));
    },

    _initProfiles: function () {
        this._folders = new Gtk.ListStore();
        this._folders.set_column_types([GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]);
        let profiles_box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        let label = new Gtk.Label({label: _('Profile')});
        hbox.pack_start(label, false, false, 10);
        this.profiles_combo_box = new Gtk.ComboBoxText();
        this.profiles_combo_box.connect('changed', Lang.bind(this, function (object) {
            for (let profile in this._settings.profiles) {
                if (profile == object.get_active_text()) {
                    this._folders.clear();
                    for (let folder in this._settings.profiles[profile]) {
                        folder = [this._settings.profiles[profile][folder][0], this._settings.profiles[profile][folder][1]];
                        this._folders.insert_with_valuesv(-1, [0, 1], folder);
                    }
                    break;
                }
            }
        }));

        hbox.pack_start(this.profiles_combo_box, true, true, 10);
        this.add_profile = new Gtk.Button({label: _('Add')});
        this.add_profile.set_sensitive(true);
        this.add_profile.connect('clicked', Lang.bind(this, function () {
            let dialog, mbox, box, label, input;
            dialog = new Gtk.Dialog();
            mbox = dialog.get_content_area();
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
            label = new Gtk.Label({label: _('Profile Name')});
            box.pack_start(label, false, true, 10);
            input = new Gtk.Entry();
            box.pack_end(input, true, true, 10);
            box.show_all();
            mbox.pack_start(box, true, true, 10);
            dialog.add_button(_('OK'), Gtk.ResponseType.OK);
            dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            let result = dialog.run();
            if (result == Gtk.ResponseType.OK) {
                let profiles = this._settings.profiles;
                profiles[input.get_text()] = [];
                this._settings.profiles = profiles;
                this._load_profiles();
            }
            dialog.destroy();
        }));
        hbox.pack_start(this.add_profile, false, true, 0);
        this.remove_profile = new Gtk.Button({label: _('Remove')});
        this.remove_profile.connect('clicked', Lang.bind(this, function () {
            let profile, dialog, box, label;
            profile = this.profiles_combo_box.get_active_text();
            dialog = new Gtk.Dialog();
            box = dialog.get_content_area();
            label = new Gtk.Label({label: _('Are you sure you want to delete the profile "%s"?'.format(profile))});
            box.pack_start(label, true, true, 10);
            box.show_all();
            dialog.add_button(_('Yes'), Gtk.ResponseType.YES);
            dialog.add_button(_('No'), Gtk.ResponseType.NO);
            let response = dialog.run();
            if (response == Gtk.ResponseType.YES) {
                let profiles = this._settings.profiles;
                delete profiles[profile];
                this._settings.profiles = profiles;
                this._load_profiles();
            }
            dialog.destroy();
        }));
        hbox.pack_start(this.remove_profile, false, true, 0);
        profiles_box.pack_start(hbox, false, false, 10);

        this.profiles = new Gtk.TreeView();
        this.profiles.get_selection().set_mode(Gtk.SelectionMode.SINGLE);
        this.profiles.set_model(this._folders);
        let renderer = new Gtk.CellRendererText();
        renderer.set_property('editable', true);
        renderer.connect('edited', Lang.bind(this, function (renderer, path, new_text) {
            let [bool, iter] = this._folders.get_iter_from_string(path);
            this._folders.set_value(iter, 0, new_text);
            this._save_profile();
        }));
        let column = new Gtk.TreeViewColumn({title: _('Path'), expand: true});
        column.pack_start(renderer, true);
        column.add_attribute(renderer, 'text', 0);
        this.profiles.append_column(column);

        renderer = new Gtk.CellRendererToggle();
        renderer.connect('toggled', Lang.bind(this, this.toggle_subfolders));
        column = new Gtk.TreeViewColumn({title: _('Sub Folders'), expand: false});
        column.pack_start(renderer, false);
        column.add_attribute(renderer, 'active', 1);
        this.profiles.append_column(column);

        hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        this.remove = new Gtk.Button({label: _('Remove')});
        this.remove.connect('clicked', Lang.bind(this, function () {
            let [bool, list, iter] = this.profiles.get_selection().get_selected();
            let path = list.get_path(iter);
            list.row_deleted(path);
            let profiles = this._settings.profiles;
            profiles[this.profiles_combo_box.get_active_text()].splice(path.get_indices(), 1);
            this._settings.profiles = profiles;
            this.remove.set_sensitive(false);
        }));
        this.profiles.connect('cursor_changed', Lang.bind(this, function (treeview) {
            this.remove.set_sensitive(true);
        }));
        this.remove.set_sensitive(false);
        hbox.pack_start(this.remove, false, true, 10);
        label = new Gtk.Label({label: ' '});
        hbox.pack_start(label, true, true, 0);
        this.add = new Gtk.Button({label: _('Add Image')});
        this.add.connect('clicked', Lang.bind(this, function () {
            this._add_item(_('Add Image'), Gtk.FileChooserAction.OPEN);
        }));
        hbox.pack_start(this.add, false, true, 10);
        this.add = new Gtk.Button({label: _('Add Folder')});
        this.add.connect('clicked', Lang.bind(this, function () {
            this._add_item(_('Add Folder'), Gtk.FileChooserAction.SELECT_FOLDER);
        }));
        hbox.pack_start(this.add, false, true, 10);
        profiles_box.pack_end(hbox, false, true, 10);

        profiles_box.pack_start(this.profiles, true, true, 10);
        this.notebook.append_page(profiles_box, new Gtk.Label({label: _('Profiles')}));
    },

    _add_item: function (title, action) {
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
        if (response == Gtk.ResponseType.OK) {
            let paths = dialog.get_uris(), profile, profiles = this._settings.profiles;
            profile = this.profiles_combo_box.get_active_text();
            for (let path in paths) {
                profiles[profile].push([paths[path], false]);
            }
            this._settings.profiles = profiles;
            this._load_profiles();
        }
        dialog.destroy();
    },

    _keybindingExists: function (value) {
        if (this._settingsKeybind.length == 0) {
            this._settingsKeybind.push(new Gio.Settings({schema: 'org.gnome.desktop.wm.keybindings'}));
            this._settingsKeybind.push(new Gio.Settings({schema: 'org.gnome.mutter.keybindings'}));
            this._settingsKeybind.push(new Gio.Settings({schema: 'org.gnome.mutter.wayland.keybindings'}));
            this._settingsKeybind.push(new Gio.Settings({schema: 'org.gnome.shell.keybindings'}));
            this._settingsKeybind.push(new Gio.Settings({schema: 'org.gnome.settings-daemon.plugins.media-keys'}));
        }

        for (let i = 0; i < this._settingsKeybind.length; i++) {
            let keys = this._settingsKeybind[i].list_keys();
            for (let x = 0; x < keys.length; x++) {
                let _value = this._settingsKeybind[i].get_value(keys[x]);
                if (!_value) continue;
                if (_value.get_type_string() == 's') {
                    if (_value.get_string() == value) {
                        return true;
                    }
                } else if (_value.get_type_string() == 'as') {
                    _value = _value.get_strv(_value);
                    for (let n = 0; n < _value.length; n++) {
                        if (_value[n] == value) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    },

    _load_profiles: function () {
        let active = this.profiles_combo_box.get_active(),
            lActive = -1,
            i = 0,
            text = this.profiles_combo_box.get_active_text();
        this.profiles_combo_box.remove_all();
        this._currentProfile.remove_all();
        this._lockscreenProfile.remove_all();

        for (let profile in this._settings.profiles) {
            this.profiles_combo_box.insert_text(i, profile);
            this._currentProfile.insert_text(i, profile);
            this._lockscreenProfile.insert_text(i, profile);

            if (text === profile || (active === -1 && profile === this._settings.current_profile)) {
                active = i;
            }

            if (profile === this._settings.lockscreen_profile) {
                lActive = i;
            }

            i++;
        }

        this.profiles_combo_box.set_active(active);
        this._currentProfile.set_active(active);
        this._lockscreenProfile.set_active(lActive);
    },

    _save_profile: function () {
        let profile = [];
        this._folders.foreach(Lang.bind(profile, function (model, path, iter) {
            this.push([model.get_value(iter, 0), model.get_value(iter, 1)]);
        }));
        debug(JSON.stringify(profile));
        debug(this.profiles_combo_box.get_active_text());
        let profiles = this._settings.profiles;
        profiles[this.profiles_combo_box.get_active_text()] = profile;
        this._settings.profiles = profiles;
        this.profiles_combo_box.do_changed();
    },

    _update_rotation: function () {
        switch (this._settings.rotation) {
            case 'interval':
                this._rotation_combo_box.set_active(0);
                break;
            case 'hourly':
                this._rotation_combo_box.set_active(1);
                break;
            default:
                this._rotation_combo_box.set_active(2);
                break;
        }
    }
});

function buildPrefsWidget() {
    let widget = new DeskChangerPrefs();
    return (widget.box);
}

function init() {
    debug("init");
}
