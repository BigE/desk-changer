import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {APP_ID, APP_PATH} from './common/interface.js';
import Profile from './common/profile/index.js';
import ProfileItem from './common/profile/item.js';
import {SettingsProfileType} from './common/settings.js';
import _AboutPage from './ui/prefs/about_page.js';
import _ExtensionPage from './ui/prefs/extension_page.js';
import _KeyboardPage from './ui/prefs/keyboard/page.js';
import _ProfilesPage from './ui/prefs/profiles_page.js';
import _ServicePage from './ui/prefs/service_page.js';

export let AboutPage: typeof _AboutPage | undefined;
export let ExtensionPage: typeof _ExtensionPage | undefined;
export let KeyboardPage: typeof _KeyboardPage | undefined;
export let ProfilesPage: typeof _ProfilesPage | undefined;
export let ServicePage: typeof _ServicePage | undefined;

export default class DeskChangerPreferences extends ExtensionPreferences {
    #current_profile_index?: number;
    #extension_page?: _ExtensionPage;
    #keyboard_page?: _KeyboardPage;
    #logger?: Console;
    #profiles?: Gio.ListStore<Profile>;
    #profiles_page?: _ProfilesPage;
    #resource?: Gio.Resource;
    #service_page?: _ServicePage;
    #settings?: Gio.Settings;

    async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        this.#resource = Gio.Resource.load(`${this.path}/${APP_ID}.gresource`);
        Gio.resources_register(this.#resource);
        this.#logger =
            'getLogger' in this && typeof this.getLogger === 'function'
                ? (this.getLogger() as unknown as Console)
                : (console as unknown as Console);
        this.#settings = this.getSettings();

        AboutPage ??= GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPrefsAboutPage',
                InternalChildren: [
                    'description_label',
                    'version_label'
                ],
                Template: `resource://${APP_PATH}/ui/prefs/about_page.ui`,
            },
            _AboutPage
        );

        ExtensionPage ??= GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPrefsExtensionPage',
                InternalChildren: [
                    'current_profile_combo',
                    'icon_preview_switch',
                    'notifications_switch',
                ],
                Template: `resource://${APP_PATH}/ui/prefs/extension_page.ui`,
            },
            _ExtensionPage
        );

        KeyboardPage ??= GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPrefsKeyboardPage',
                InternalChildren: ['keymap_listbox'],
                Template: `resource://${APP_PATH}/ui/prefs/keyboard_page.ui`,
            },
            _KeyboardPage
        );

        ProfilesPage ??= GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPrefsProfilesPage',
                InternalChildren: [
                    'combo_row_profiles',
                    'locations_listview',
                    'locations_selection',
                    'remove_item_button',
                    'remove_profile_button',
                ],
                Template: `resource://${APP_PATH}/ui/prefs/profiles_page.ui`,
            },
            _ProfilesPage
        );

        ServicePage ??= GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPrefsServicePage',
                InternalChildren: [
                    'allowed_mime_types_listbox',
                    'allowed_mime_types_reset_button',
                    'daemon_auto_start_switch',
                    'daemon_remember_profile_state_switch',
                    'daemon_running_switch',
                    'gamemode_switch',
                    'random_switch',
                    'rotation_custom_interval_spinner',
                    'rotation_mode_combo',
                ],
                Template: `resource://${APP_PATH}/ui/prefs/service_page.ui`,
            },
            _ServicePage
        );

        this.#load_profiles();
        this.#extension_page = new ExtensionPage(
            this.#profiles!,
            this.#current_profile_index!,
            this.#settings
        );
        this.#keyboard_page = new KeyboardPage(this.#settings);
        this.#profiles_page = new ProfilesPage(
            this.#profiles!,
            this.#current_profile_index!,
            this.#settings
        );
        this.#service_page = new ServicePage(this.#settings, this.#logger);
        window.add(this.#profiles_page);
        window.add(this.#keyboard_page);
        window.add(this.#extension_page);
        window.add(this.#service_page);
        window.add(new AboutPage(this.metadata.description, this.metadata.version));

        window.connect('close-request', () => {
            this.#extension_page?.destroy();
            this.#extension_page = undefined;
            this.#keyboard_page?.destroy();
            this.#keyboard_page = undefined;
            this.#profiles_page?.destroy();
            this.#profiles_page = undefined;
            this.#service_page?.destroy();
            this.#service_page = undefined;
            this.#profiles?.remove_all();
            this.#profiles = undefined;
            this.#settings = undefined;
            if (this.#resource) Gio.resources_unregister(this.#resource);
            this.#resource = undefined;
        });
    }

    /**
     * Load the profiles into a Gio.ListStore
     *
     * This method takes all the profiles loaded into the settings and puts
     * them in GObject.Object containers. This allows for easier interaction
     * within the prefs.
     *
     * @private
     */
    #load_profiles() {
        const profiles = Object.entries(
            this.#settings!.get_value(
                'profiles'
            ).deepUnpack<SettingsProfileType>()
        );
        const current_profile = this.#settings!.get_string('current-profile');

        if (!this.#profiles) this.#profiles = new Gio.ListStore<Profile>();

        this.#profiles.remove_all();
        for (let i = 0; i < profiles.length; i++) {
            const [name, _items] = profiles[i];

            if (current_profile === name) this.#current_profile_index = i;

            const items = new Gio.ListStore<ProfileItem>();
            _items.forEach(item =>
                items.append(new ProfileItem(item[0], item[1]))
            );
            this.#profiles.append(new Profile(name, items));
        }
    }
}
