import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import DeskChanger from './deskchanger.js';
import Interface from './daemon/interface.js';
import { makeProxyWrapper } from './service.js';

export default class DeskChangerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._daemon = makeProxyWrapper();

        this._initProfiles(window);
        this._initKeyboard(window);
        this._initExtension(window);
        this._initDaemon(window);
        this._initAbout(window);

        this._load_profiles();
    }

    _initAbout(window) {
        const page = new Adw.PreferencesPage({ icon_name: 'dialog-information-symbolic', title: _('About') }),
              group = new Adw.PreferencesGroup();

        this._aboutBox = new AboutBox();
        group.add(this._aboutBox);
        page.add(group);
        window.add(page);
    }

    _initDaemon(window) {
        const page = new Adw.PreferencesPage({ icon_name: 'application-x-executable-symbolic', title: _('Daemon') }),
              group = new Adw.PreferencesGroup();

        this._daemonBox = new DaemonBox(this._daemon);
        group.add(this._daemonBox);
        page.add(group);
        window.add(page);
    }

    _initExtension(window) {
        const page = new Adw.PreferencesPage({ icon_name: 'applications-system-symbolic', title: _('Extension') }),
              group = new Adw.PreferencesGroup();

        this._extensionBox = new ExtensionBox();
        group.add(this._extensionBox);
        page.add(group);
        window.add(page);
    }

    _initKeyboard(window) {
        const page = new Adw.PreferencesPage({ icon_name: 'input-keyboard-symbolic', title: _('Keyboard') }),
              group = new Adw.PreferencesGroup();
        
              this._keyboardBox = new KeyboardBox();
              group.add(this._keyboardBox);
              page.add(group);
              window.add(page);
    }

    _initProfiles(window) {
        const page = new Adw.PreferencesPage({ icon_name: 'view-list-symbolic', title: _('Profiles') }),
              group = new Adw.PreferencesGroup();

        this._profilesBox = new ProfilesBox();
        group.add(this._profilesBox);
        page.add(group);
        window.add(page);
    }

    _load_profiles() {
        this._profilesBox._profiles.clear();

        for (let profile in Interface.settings.profiles) {
            let location_iterator = this._profilesBox._profiles.append(),
                current_iterator = this._extensionBox._profiles.append();

            this._extensionBox._profiles.set_value(current_iterator, 0, profile);
            this._profilesBox._profiles.set_value(location_iterator, 0, profile);

            if (Interface.settings.current_profile === profile) {
                this._extensionBox._combo_current_profile.set_active_iter(current_iterator);
                this._profilesBox._combo_location_profile.set_active_iter(location_iterator);
            }
        }
    }
}

const AboutBox = GObject.registerClass({
    GTypeName: 'AboutBox',
    InternalChildren: [
        'label_about_description',
        'label_about_name',
        'label_about_url',
        'label_about_version',
    ],
    Template: `resource://${DeskChanger.app_path}/ui/prefs/about.ui`,
},
class DeskChangerPreferencesAboutBox extends Gtk.Box {
    constructor(params = {}) {
        super(params);

        this._label_about_description.set_label(DeskChanger.metadata.description);
        this._label_about_name.set_label(DeskChanger.metadata.name);
        this._label_about_url.set_markup(`<a href="${DeskChanger.metadata.url}">${DeskChanger.metadata.url}</a>`);
        this._label_about_version.set_label(`Version ${DeskChanger.metadata.version}`);
    }
});

const DaemonBox = GObject.registerClass({
    GTypeName: 'DaemonBox',
    InternalChildren: [
        'allowed_mime_types',
        'combo_rotation_mode',
        'interval',
        'spinner_interval',
        'switch_auto_start',
        'switch_daemon_state',
        'switch_remember_profile_state',
    ],
    Template: `resource://${DeskChanger.app_path}/ui/prefs/daemon.ui`,
},
class DeskChangerPreferencesDaemonBox extends Gtk.Box {
    constructor(daemon, params = {}) {
        let mime_types = Interface.settings.allowed_mime_types.join("\n");

        super(params);

        this._daemon = daemon;

        Interface.settings.bind('auto-start', this._switch_auto_start, 'active', Gio.SettingsBindFlags.DEFAULT);
        Interface.settings.bind('interval', this._spinner_interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        Interface.settings.bind('remember-profile-state', this._switch_remember_profile_state, 'active', Gio.SettingsBindFlags.DEFAULT);

        this._allowed_mime_types.set_text(mime_types, mime_types.length);
        this._combo_rotation_mode.set_model(DeskChanger.rotation);
        this._combo_rotation_mode.set_active_id(Interface.settings.rotation);
        this._switch_daemon_state.set_active(this._daemon.Running);
        this._daemon.connectSignal('Running', (proxy, name, [state]) => {
            this._switch_daemon_state.set_active(state);
        });
    }

    _on_buffer_allowed_mime_types_changed() {
        if (this._is_init) return;

        let start = this._allowed_mime_types.get_start_iter(),
            end = this._allowed_mime_types.get_end_iter(),
            text = this._allowed_mime_types.get_text(start, end, false)
        Interface.settings.allowed_mime_types = text.split("\n");
    }

    _on_combo_rotation_mode_changed(_widget) {
        let [ok, iterator] = this._combo_rotation_mode.get_active_iter();

        if (this._is_init || !ok) return;
        Interface.settings.rotation = DeskChanger.rotation.get_value(iterator, 0);
    }

    _on_switch_daemon_running_state() {
        if (this._is_init) return false;

        if (state)
            this._daemon.StartSync();
        else
            this._daemon.StopSync(false);
        return false;
    }
});

const ExtensionBox = GObject.registerClass({
    GTypeName: 'ExtensionBox',
    InternalChildren: [
        'combo_current_profile',
        'profiles',
    ],
    Template: `resource://${DeskChanger.app_path}/ui/prefs/extension.ui`,
},
class DeskChangerPreferencesExtensionBox extends Gtk.Box {
    _on_combo_current_profile_changed() {
    }
});

const KeyboardBox = GObject.registerClass({
    GTypeName: 'KeyboardBox',
    InternalChildren: [],
    Template: `resource://${DeskChanger.app_path}/ui/prefs/keyboard.ui`,
},
class DeskChangerPreferencesKeyboardBox extends Gtk.Box {
    _on_accel_key(_widget, path, key=0, mods=0, keycode=0) {
        Logger.debug(_widget);
        let [success, iterator] = this._keyboard.get_iter_from_string(path);

        if (!success) {
            throw new Error(_('Failed to update keybinding'));
        }

        let name = this._keyboard.get_value(iterator, 3),
            value = Gtk.accelerator_name(key, mods);
        this._keyboard.set(iterator, [1, 2], [mods, key]);
        Interface.settings.setKeybinding(name, value);
    }
});

const ProfilesBox = GObject.registerClass({
    GTypeName: 'ProfilesBox',
    InternalChildren: [
        'combo_location_profile',
        'locations',
        'profiles',
        'tree_locations',
    ],
    Template: `resource://${DeskChanger.app_path}/ui/prefs/profiles.ui`,
},
class DeskChangerPreferencesProfilesBox extends Gtk.Box {
    _get_location_profile() {
        let [ok, iterator] = this._combo_location_profile.get_active_iter();

        if (!ok) return false;

        return this._profiles.get_value(iterator, 0);
    }

	_on_button_add_items_clicked() {
	}

	_on_button_add_folders_clicked() {
	}

	_on_button_remove_item_clicked() {
	}

	_on_button_add_profile_clicked() {
	}

	_on_button_remove_profile_clicked() {
	}

    _on_cell_location_edited(_widget, path, new_text) {
        const [ok, iterator] = this._locations.get_iter_from_string(path);

        if (!ok) return;

        this._locations.set_value(iterator, 0, new_text);
        this._update_location_profile(path, 0, new_text);
    }

    _on_cell_recursive_toggled(_widget, path) {
        let [ok, iterator] = this._locations.get_iter_from_string(path),
            new_value;

        Logger.debug(`path: ${path}; ok: ${ok}; iterator: ${iterator}`);
        if (!ok) return;
        new_value = !this._locations.get_value(iterator, 1);
        this._locations.set_value(iterator, 1, new_value);
        this._update_location_profile(path, 1, new_value);
    }

    _on_combo_location_profile_changed(_widget) {
        let [ok, iterator] = this._combo_location_profile.get_active_iter(),
            profile;

        if (!ok) return;
        profile = this._profiles.get_value(iterator, 0);
        this._locations.clear();

        Interface.settings.profiles[profile].forEach(item => {
            let [uri, recursive] = item;

            iterator = this._locations.append();
            // TODO: fill in third parameter
            this._locations.set(iterator, [0, 1, 2], [uri, recursive, true]);
        });
    }

    _update_location_profile(path, column, value) {
        let profiles = Interface.settings.profiles;
        const profile = this._get_location_profile();

        profiles[profile][Number.parseInt(path)][column] = value;
        Interface.settings.profiles = profiles;
    }
});