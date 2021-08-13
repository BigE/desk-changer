'use strict';

const {Gio, GObject, Gtk} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
Me.imports._deskchanger;
const _ = deskchanger._;

const AddItemsDialog = GObject.registerClass({
    GTypeName: 'AddItemsDialog',
},
class AddItemsDialog extends Gtk.FileChooserDialog {
    _init(params = {}) {
        if (params['action'] === Gtk.FileChooserAction.OPEN) {
            let filter = new Gtk.FileFilter();
            filter.set_name(_("Allowed File Types"));
            deskchanger.settings.allowed_mime_types.forEach(value => {
                filter.add_mime_type(value);
            });
            params['filter'] = filter;
        }

        if (!('select-multiple' in params)) {
            params['select-multiple'] = true;
        }

        super._init(params);

        this.add_button(_('Add'), Gtk.ResponseType.OK);
        this.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
    }
});

const PrefsWidget = GObject.registerClass({
    GTypeName: 'PrefsWidget',
    InternalChildren: [
        'btn_remove_item',
        'buffer_allowed_mime_types',
        'combo_profiles',
        'combo_current_profile',
        'combo_rotation',
        'keyboard',
        'locations',
        'spinner_interval',
        'switch_auto_start_daemon',
        'switch_daemon_status',
        'switch_icon_as_preview',
        'switch_notifications',
        'switch_remember_profile',
        'tree_keyboard',
        'tree_profiles',
    ],
    Template: Me.dir.get_child('prefs.ui').get_uri(),
},
class PrefsWidget extends Gtk.Box {
    _init(params = {}) {
        let mime_types = deskchanger.settings.allowed_mime_types.join("\n"),
            iter = null,
            success = null;
        
        this._is_init = true;
        this._is_load_profiles = false;
        this._is_profile_changed = false;
        // Set up us.
        super._init(params);

        this._buffer_allowed_mime_types.set_text(mime_types, mime_types.length);
        // load the profile combo boxes
        this._load_profiles(this._combo_profiles);
        this._load_profiles(this._combo_current_profile);
        // load the keybindings
        [success, iter] = this._tree_keyboard.model.get_iter_first();
        while (success) {
            let name = this._keyboard.get_value(iter, 3),
                [ok, key, mods] = Gtk.accelerator_parse(deskchanger.settings.getKeybinding(name));
            
            if (ok) {
                deskchanger.debug(`name: ${name}; mods: ${mods}; key: ${key}`);
                this._keyboard.set(iter, [1, 2], [mods, key]);
                success = this._tree_keyboard.model.iter_next(iter);
            }
        }

        deskchanger.settings.bind('auto-start', this._switch_auto_start_daemon, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('icon-preview', this._switch_icon_as_preview, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('interval', this._spinner_interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('notifications', this._switch_notifications, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('remember-profile-state', this._switch_remember_profile, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('rotation', this._combo_rotation, 'active-id', Gio.SettingsBindFlags.DEFAULT);

        deskchanger.settings.connect('changed::allowed-mime-types', () => {
            let mime_types = deskchanger.settings.allowed_mime_types.join("\n");
            this._buffer_allowed_mime_types.set_text(mime_types, mime_types.length);
        });
        deskchanger.settings.connect('changed::profiles', () => {
            this._load_profiles(this._combo_profiles);
            this._load_profiles(this._combo_current_profile);
        });

        this._is_init = false;
    }

    _load_profiles(_combobox, text=null) {
        let active = _combobox.get_active(),
            i = 0;

        this._is_load_profiles = true;
        if (!text) {
            text = _combobox.get_active_text();
        }

        _combobox.remove_all();

        for (let profile in deskchanger.settings.profiles) {
            _combobox.insert_text(i, profile);

            if (text === profile || (active === -1 && profile === deskchanger.settings.current_profile)) {
                _combobox.set_active(i);
            }

            i++;
        }
        this._is_load_profiles = false;
    }

    _on_accel_cleared(_widget, path) {
        deskchanger.debug(`_on_accel_cleared(_widget: ${_widget}, path: ${path}`);
        this._update_keybindings(path, 0, 0, '');
    }

    _on_accel_edited(_widget, path, key, mods, keycode) {
        deskchanger.debug(`_on_accel_edited(_widget: ${_widget}, path: ${path}, key: ${key}, mods: ${mods}, keycode: ${keycode})`);
        let value = Gtk.accelerator_name(key, mods);
        this._update_keybindings(path, key, mods, value);
    }

    _on_add_folders_clicked() {
        let dialog = new AddItemsDialog({title: 'Add Folders', action: Gtk.FileChooserAction.SELECT_FOLDER});

        dialog.show();
        dialog.connect('response', this._on_add_items_response.bind(this));
    }

    _on_add_images_clicked() {
        let dialog = new AddItemsDialog({title: 'Add Images', action: Gtk.FileChooserAction.OPEN});

        dialog.show();
        dialog.connect('response', this._on_add_items_response.bind(this));
    }

    _on_add_items_response(_dialog, response) {
        if (response === Gtk.ResponseType.OK) {
            let list = _dialog.get_files();
            for (let i = 0; i < list.get_n_items(); i++) {
                let item = list.get_item(i);
                this._locations.insert_with_values(-1, [0, 1], [item.get_uri(), false]);
            }
        }

        _dialog.destroy();
    }

    _on_add_profile() {
        let dialog = new Gtk.Dialog(),
            mbox = dialog.get_content_area(),
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
            label = new Gtk.Label({label: _('Profile Name')}),
            input = new Gtk.Entry();

        box.append(label);
        box.append(input);
        mbox.append(box);
        dialog.add_button(_('OK'), Gtk.ResponseType.OK);
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.connect('response', (_dialog, result) => {
            deskchanger.debug(result);
            deskchanger.debug(Gtk.ResponseType.OK);
            if (result === Gtk.ResponseType.OK) {
                let _profiles = deskchanger.settings.profiles,
                    profile = input.get_text();
                _profiles[profile] = [];
                deskchanger.settings.profiles = _profiles;
                this._load_profiles(this._combo_profiles, profile);
            }
            dialog.destroy();
        });
        dialog.show();
    }

    _on_current_profile_changed(_combobox) {
        if (this._is_load_profiles) return;

        let profile = _combobox.get_active_text();

        if (deskchanger.settings.current_profile !== profile) {
            deskchanger.settings.current_profile = profile;
        }
    }

    _on_locations_changed(_list, position, removed, added) {
        if (this._is_init || this._is_profile_changed) return;

        let profiles = deskchanger.settings.profiles,
            profile = this._combo_profiles.get_active_text();

        profiles[profile] = [];
        this._locations.foreach((_store, _path, _iter) => {
            profiles[profile].push([this._locations.get_value(_iter, 0), this._locations.get_value(_iter, 1)]);
        });
        deskchanger.settings.profiles = profiles;
    }

    _on_profile_changed(_combobox) {
        this._is_profile_changed = true;
        for (let profile in deskchanger.settings.profiles) {
            if (profile === _combobox.get_active_text()) {
                this._locations.clear();

                for (let location in deskchanger.settings.profiles[profile]) {
                    let iter = this._locations.append();
                    this._locations.set_value(iter, 0, deskchanger.settings.profiles[profile][location][0]);
                    this._locations.set_value(iter, 1, deskchanger.settings.profiles[profile][location][1]);
                }

                this._tree_profiles.get_selection().select_path(Gtk.TreePath.new_first());
                break;
            }
        }
        this._is_profile_changed = false;
    }

    _on_recursive_toggled(_widget, _path) {
        let _iter = this._locations.get_iter_from_string(_path)[1];

        this._locations.set_value(_iter, 1, !this._locations.get_value(_iter, 1));
    }

    _on_remove_item_clicked() {
        let [bool, list, iter] = this._tree_profiles.get_selection().get_selected();
        this._locations.remove(iter);
        this._btn_remove_item.set_sensitive(false);
    }

    _on_remove_profile() {
        if (deskchanger.settings.current_profile == this._combo_profiles.get_active_text()) {
            let dialog = new Gtk.MessageDialog({
                'buttons': Gtk.ButtonsType.CLOSE,
                'message-type': Gtk.MessageType.ERROR,
                'text': 'ERROR: You cannot remove the current profile',
            });
            dialog.show();
            dialog.connect('response', () => {
                dialog.destroy();
            });
            return;
        }

        let profile = this._combo_profiles.get_active_text(), dialog = new Gtk.MessageDialog({
            'buttons': Gtk.ButtonsType.YES_NO,
            'message-type': Gtk.MessageType.QUESTION,
            'text': 'Are you sure you want to delete the profile "' + profile + '"',
        });
        dialog.show();
        dialog.connect('response', (_dialog, response) => {
            if (response === Gtk.ResponseType.YES) {
                let profiles = deskchanger.settings.profiles;
                this._combo_profiles.set_active(-1);
                delete profiles[profile];
                deskchanger.settings.profiles = profiles;
            }
            
            dialog.destroy();
        });
    }

    _on_buffer_allowed_mime_types_changed() {
        if (this._is_init) return;
        deskchanger.settings.allowed_mime_types = this._buffer_allowed_mime_types.get_text(this._buffer_allowed_mime_types.get_start_iter(), this._buffer_allowed_mime_types.get_end_iter(), false);
    }

    _update_keybindings(path, key, mods, value) {
        let [success, iterator] = this._keyboard.get_iter_from_string(path);

        if (!success) {
            throw new Error(_('Failed to update keybinding'));
        }

        let name = this._keyboard.get_value(iterator, 3);
        this._keyboard.set(iterator, [1, 2], [mods, key]);
        deskchanger.settings.setKeybinding(name, value);
    }
});

function init() {
    ExtensionUtils.initTranslations('desk-changer');
}

function buildPrefsWidget() {
    return new PrefsWidget();
}
