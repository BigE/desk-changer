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
        'keyboard',
        'locations',
        'profiles',
        'spinner_interval',
        'switch_auto_start',
        'switch_daemon_state',
        'switch_icon_preview',
        'switch_notifications',
        'switch_remember_profile_state',
    ],
    Template: `resource://${deskchanger.app_path}/ui/${(shellVersion < 40)? 'prefs.3.ui' : 'prefs.ui'}`,
},
class PrefsWidget extends Gtk.Box {
    _init(params={}) {
        let success, iterator,
            mime_types = deskchanger.settings.allowed_mime_types.join("\n");

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
        iterator.free();

        // load everything else
        this._allowed_mime_types.set_text(mime_types, mime_types.length);
        this._load_profiles();
        this._switch_daemon_state.set_active(this._daemon.Running);
        this._daemon.connectSignal('Running', (proxy, name, [state]) => {
            this._switch_daemon_state.set_active(state);
        });


        if (shellVersion < 40) {
            // show it all
            this.show_all();
        }
    }

    _load_profiles() {
        this._profiles.clear();

        for (let profile in deskchanger.settings.profiles) {
            let iterator = this._profiles.append();
            this._profiles.set_value(iterator, 0, profile);
            if (deskchanger.settings.current_profile === profile) {
                this._combo_current_profile.set_active_iter(iterator);
            }
            iterator.free();
        }

        this._combo_location_profile.set_active(0);
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
    }

    _on_button_add_folders_clicked() {
    }

    _on_button_add_items_clicked() {
    }

    _on_button_add_profile_clicked() {
    }

    _on_button_remove_item_clicked() {
    }

    _on_button_remove_profile_clicked() {
    }

    _on_cell_recursive_toggled() {
    }

    _on_cell_location_edited() {
    }

    _on_combo_current_profile_changed() {
        let [ok, iterator] = this._combo_current_profile.get_active_iter(),
            profile;

        if (!ok) return;
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

    _on_combo_rotation_mode_changed() {
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
