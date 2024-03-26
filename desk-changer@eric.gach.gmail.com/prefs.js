import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import Interface from './daemon/interface.js';
import ProfilesPage from './ui/prefs/profiles.js';
import { Location, Profile } from './ui/common/profiles.js';
import KeyboardPage from './ui/prefs/keyboard.js';
import ExtensionPage from './ui/prefs/extension.js';
import DaemonPage from './ui/prefs/daemon.js';
import AboutPage from './ui/prefs/about.js';

export default class DeskChangerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._current_profile_index = null;
        this._profiles = Gio.ListStore.new(Profile);
        this._load_profiles();
        Interface.settings.connect('changed::profiles', () => this._load_profiles());

        this._profilesPage = new ProfilesPage({model: this._profiles, selected: this._current_profile_index});
        window.add(this._profilesPage);

        this._keyboardPage = new KeyboardPage();
        window.add(this._keyboardPage);

        this._extensionPage = new ExtensionPage({model: this._profiles, selected: this._current_profile_index});
        window.add(this._extensionPage);

        this._daemonPage = new DaemonPage();
        window.add(this._daemonPage);

        this._aboutPage = new AboutPage();
        window.add(this._aboutPage);
    }

    _load_profiles() {
        const profiles = Object.entries(Interface.settings.profiles);

        this._profiles.remove_all();

        for (const key in profiles) {
            if (Interface.settings.current_profile === profiles[key][0])
                this._current_profile_index = key;

            const locations = Gio.ListStore.new(Location);
            profiles[key][1].forEach(item => locations.append(new Location({location: item[0], recursive: item[1]})));
            this._profiles.append(new Profile({ name: profiles[key][0], locations: locations }));
        }
    }
}