'use strict';

const {Gio, GObject, Gtk} = imports.gi;
const Config = imports.misc.config;
const shellVersion = Number.parseInt(Config.PACKAGE_VERSION.split('.')[0]);
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
Me.imports._deskchanger;
const _ = deskchanger._;
const Service = Me.imports.service;

const AddItemsDialog = GObject.registerClass({
    GTypeName: 'AddItemsDialog',
},
class AddItemsDialog extends Gtk.FileChooserDialog {
    _init(params = {}) {
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
        'allowed_mime_types',
        'combo_current_profile',
        'combo_location_profile',
        'combo_rotation_mode',
        'keyboard',
        'locations',
        'profiles',
        'spinner_interval',
        'switch_auto_start',
        'switch_daemon_state',
        'switch_icon_preview',
        'switch_notifications',
        'switch_remember_profile_state',
        'tree_locations',
    ],
    Template: `resource://${deskchanger.app_path}/ui/${(shellVersion < 40)? 'prefs.3.ui' : 'prefs.ui'}`,
},
class PrefsWidget extends Gtk.Box {
    _init(params={}) {
        let success, iterator,
            mime_types = deskchanger.settings.allowed_mime_types.join("\n");

        this._is_init = true;
        this._daemon = Service.makeProxyWrapper();
        // set up us the base
        super._init(params);

        // bind our simple settings
        deskchanger.settings.bind('auto-start', this._switch_auto_start, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('icon-preview', this._switch_icon_preview, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('interval', this._spinner_interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('notifications', this._switch_notifications, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('remember-profile-state', this._switch_remember_profile_state, 'active', Gio.SettingsBindFlags.DEFAULT);

        // keybindings
        [success, iterator] = this._keyboard.get_iter_first();
        while (success) {
            let name = this._keyboard.get_value(iterator, 3),
                [ok, key, mods] = Gtk.accelerator_parse(deskchanger.settings.getKeybinding(name));

            if (ok === true || mods === undefined) {
                if (mods === undefined) {
                    mods = key;
                    key = ok;
                }

                this._keyboard.set(iterator, [1, 2], [mods, key]);
                success = this._keyboard.iter_next(iterator);
            }
        }

        // load everything else
        this._allowed_mime_types.set_text(mime_types, mime_types.length);
        this._combo_rotation_mode.set_model(deskchanger.rotation);
        this._combo_rotation_mode.set_active_id(deskchanger.settings.rotation);
        this._load_profiles();
        this._switch_daemon_state.set_active(this._daemon.Running);
        this._daemon.connectSignal('Running', (proxy, name, [state]) => {
            this._switch_daemon_state.set_active(state);
        });

        this._is_init = false;
        if (shellVersion < 40) {
            // show it all
            this.show_all();
        }
    }

    _get_location_profile() {
        let [ok, iterator] = this._combo_location_profile.get_active_iter();

        if (!ok) return false;
        return this._profiles.get_value(iterator, 0);
    }

    _load_profiles() {
        this._profiles.clear();

        for (let profile in deskchanger.settings.profiles) {
            let iterator = this._profiles.append();
            this._profiles.set_value(iterator, 0, profile);
            if (deskchanger.settings.current_profile === profile) {
                this._combo_current_profile.set_active_iter(iterator);
                this._combo_location_profile.set_active_iter(iterator);
            }
        }
    }

    _on_accel_key(_widget, path, key=0, mods=0, keycode=0) {
        deskchanger.debug(_widget);
        let [success, iterator] = this._keyboard.get_iter_from_string(path);

        if (!success) {
            throw new Error(_('Failed to update keybinding'));
        }

        let name = this._keyboard.get_value(iterator, 3),
            value = Gtk.accelerator_name(key, mods);
        this._keyboard.set(iterator, [1, 2], [mods, key]);
        deskchanger.settings.setKeybinding(name, value);
    }

    _on_buffer_allowed_mime_types_changed() {
        if (this._is_init) return;

        let start = this._allowed_mime_types.get_start_iter(),
            end = this._allowed_mime_types.get_end_iter(),
            text = this._allowed_mime_types.get_text(start, end, false)
        deskchanger.settings.allowed_mime_types = text.split("\n");
    }

    _on_button_add_folders_clicked() {
        let dialog = new AddItemsDialog({'title': 'Add Folders', 'action': Gtk.FileChooserAction.SELECT_FOLDER});

        dialog.show();
        dialog.connect('response', this._on_response_add_items.bind(this));
    }

    _on_button_add_items_clicked() {
        let dialog = new AddItemsDialog({'title': 'Add Images', 'action': Gtk.FileChooserAction.OPEN}),
            filter = new Gtk.FileFilter();

        deskchanger.settings.allowed_mime_types.forEach(value => {
            filter.add_mime_type(value);
        });
        dialog.set_filter(filter);
        dialog.show();
        dialog.connect('response', this._on_response_add_items.bind(this));
    }

    _on_button_add_profile_clicked() {
        let dialog = new Gtk.Dialog(),
            mbox = dialog.get_content_area(),
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
            label = new Gtk.Label({label: _('Profile Name')}),
            input = new Gtk.Entry();

        if (shellVersion < 40) {
            box.pack_start(label, false, false, 0);
            box.pack_start(input, true, true, 0);
            mbox.pack_start(box, true, true, 0);
            mbox.show_all();
        } else {
            box.append(label);
            box.append(input);
            mbox.append(box);
        }

        dialog.add_button(_('OK'), Gtk.ResponseType.OK);
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.connect('response', (_dialog, result) => {
            if (result === Gtk.ResponseType.OK) {
                let _profiles = deskchanger.settings.profiles,
                    profile = input.get_text();
                _profiles[profile] = [];
                deskchanger.settings.profiles = _profiles;
                this._load_profiles();
                this._combo_location_profile.set_active_id(profile);
            }
            dialog.destroy();
        });
        dialog.show();
    }

    _on_button_remove_item_clicked() {
        let [ok, iterator] = this._locations.get_iter_first(),
            profile = this._get_location_profile(),
            profiles, index, model;

        if (!ok) return;
        
        if (this._locations.iter_n_children(iterator) === 1) {
            let dialog = new Gtk.MessageDialog({
                'buttons': Gtk.ButtonsType.OK,
                'message-type': Gtk.MessageType.ERROR,
                'text': 'You cannot remove the last item in a profile',
            });
            dialog.show();
            dialog.connect('response', () => {
                dialog.destroy();
            });
            return;
        }

        [ok, model, iterator] = this._tree_locations.get_selection().get_selected();
        index = this._locations.get_string_from_iter(iterator);
        this._locations.remove(iterator);
        profiles = deskchanger.settings.profiles;
        profiles[profile].splice(index);
        deskchanger.settings.profiles = profiles;
    }

    _on_button_remove_profile_clicked() {
        let [ok, iterator] = this._combo_location_profile.get_active_iter(),
            profile, profiles, dialog;

        if (!ok) return;
        profile = this._profiles.get_value(iterator, 0);

        if (deskchanger.settings.current_profile === profile) {
            dialog = new Gtk.MessageDialog({
                'buttons': Gtk.ButtonsType.CLOSE,
                'message-type': Gtk.MessageType.ERROR,
                'text': 'You cannot remove the current profile',
            });
            dialog.show();
            dialog.connect('response', (_dialog, response) => {
                dialog.destroy();
            })
            return;
        }

        dialog = new Gtk.MessageDialog({
            'buttons': Gtk.ButtonsType.YES_NO,
            'message-type': Gtk.MessageType.QUESTION,
            'text': `Are you sure you want to remove the profile "${profile}"?`
        });
        dialog.show();
        dialog.connect('response', (_dialog, response) => {
            if (response === Gtk.ResponseType.YES) {
                profiles = deskchanger.settings.profiles;
                delete profiles[profile];
                deskchanger.settings.profiles = profiles;
                this._load_profiles();
            }

            dialog.destroy();
        });
    }

    _on_cell_location_edited(_widget, path, new_text) {
        let [ok, iterator] = this._locations.get_iter_from_string(path);

        if (!ok) return;
        this._locations.set_value(iterator, 0, new_text);
        this._update_location_profile(path, 0, new_text);
    }

    _on_cell_recursive_toggled(_widget, path) {
        let [ok, iterator] = this._locations.get_iter_from_string(path),
            new_value;

        deskchanger.debug(`path: ${path}; ok: ${ok}; iterator: ${iterator}`);
        if (!ok) return;
        new_value = !this._locations.get_value(iterator, 1);
        this._locations.set_value(iterator, 1, new_value);
        this._update_location_profile(path, 1, new_value);
    }

    _on_combo_current_profile_changed() {
        let [ok, iterator] = this._combo_current_profile.get_active_iter(),
            profile;

        if (this._is_init || !ok) return;
        profile = this._profiles.get_value(iterator, 0);
        deskchanger.settings.current_profile = profile;
    }

    _on_combo_location_profile_changed(_widget) {
        let [ok, iterator] = this._combo_location_profile.get_active_iter(),
            profile;

        if (!ok) return;
        profile = this._profiles.get_value(iterator, 0);
        this._locations.clear();

        deskchanger.settings.profiles[profile].forEach(item => {
            let [uri, recursive] = item;

            iterator = this._locations.append();
            // TODO: fill in third parameter
            this._locations.set(iterator, [0, 1, 2], [uri, recursive, true]);
        });
    }

    _on_combo_rotation_mode_changed(_widget) {
        let [ok, iterator] = this._combo_rotation_mode.get_active_iter();

        if (this._is_init || !ok) return;
        deskchanger.settings.rotation = deskchanger.rotation.get_value(iterator, 0);
    }

    _on_response_add_items(_dialog, response)
    {
        if (response === Gtk.ResponseType.OK) {
            let list = _dialog.get_files(),
                length = (shellVersion < 40)? list.length : list.get_n_items(),
                profiles = deskchanger.settings.profiles,
                profile = this._get_location_profile();
            deskchanger.debug(typeof list);

            for (let i = 0; i < length; i++) {
                let item, values;
                item = (shellVersion < 40)? list[i] : list.get_item(i);
                values = [item.get_uri(), false, true];
                if (shellVersion < 40)
                    this._locations.insert_with_valuesv(-1, [0, 1, 2], values);
                else
                    this._locations.insert_with_values(-1, [0, 1, 2], values);
                profiles[profile].push(values);
            }
            deskchanger.settings.profiles = profiles;
        }

        _dialog.destroy();
    }

    _on_switch_daemon_running_state(_widget, state) {
        if (this._is_init) return false;

        if (state)
            this._daemon.StartSync();
        else
            this._daemon.StopSync(false);
        return false;
    }

    _update_location_profile(path, column, value) {
        let profiles = deskchanger.settings.profiles,
            profile = this._get_location_profile();

        profiles[profile][Number.parseInt(path)][column] = value;
        deskchanger.settings.profiles = profiles;
    }
});

function init() {
    deskchanger.debug('init()');
    ExtensionUtils.initTranslations('desk-changer');
}

function buildPrefsWidget() {
    deskchanger.debug('buildPrefsWidget()');
    return new PrefsWidget();
}
