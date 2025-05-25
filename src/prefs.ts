import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import {APP_ID, APP_PATH} from "./common/interface.js";
import Profile, {ProfileType} from "./common/profile/index.js";
import ProfileItem, {ProfileItemType} from "./common/profile/item.js";
import ProfileSettingsType from "./common/profile/settings.js";
import _AboutPage from "./ui/prefs/about_page.js";
import _ExtensionPage from "./ui/prefs/extension_page.js";
import _KeyboardPage from "./ui/prefs/keyboard/page.js";
import _ProfilesPage from "./ui/prefs/profiles_page.js";
import _ServicePage from "./ui/prefs/service_page.js";

export let AboutPage: typeof _AboutPage | undefined;
export let ExtensionPage: typeof _ExtensionPage | undefined;
export let KeyboardPage: typeof _KeyboardPage | undefined;
export let ProfilesPage: typeof _ProfilesPage | undefined;

export default class DeskChangerPreferences extends ExtensionPreferences {
    #current_profile_index?: number;
    #profiles?: Gio.ListStore<ProfileType>;
    #profiles_page?: Adw.PreferencesPage;
    #resource?: Gio.Resource;
    #settings?: Gio.Settings;

    async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        this.#resource = Gio.Resource.load(`${this.path}/${APP_ID}.gresource`);
        Gio.resources_register(this.#resource);
        this.#settings = this.getSettings();

        /*
        const ServicePage = GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsServicePage",
            Template: `resource://${APP_PATH}/ui/prefs/service_page.ui`
        }, _ServicePage);
        */

        if (!AboutPage) {
            AboutPage = GObject.registerClass({
                GTypeName: "DeskChangerUiPrefsAboutPage",
                Template: `resource://${APP_PATH}/ui/prefs/about_page.ui`
            }, _AboutPage);
        }

        if (!ExtensionPage) {
            ExtensionPage = GObject.registerClass({
                GTypeName: "DeskChangerUiPrefsExtensionPage",
                InternalChildren: ['current_profile_combo', 'icon_preview_switch', 'notifications_switch'],
                Template: `resource://${APP_PATH}/ui/prefs/extension_page.ui`
            }, _ExtensionPage);
        }

        if (!KeyboardPage) {
            KeyboardPage = GObject.registerClass({
                GTypeName: "DeskChangerUiPrefsKeyboardPage",
                Template: `resource://${APP_PATH}/ui/prefs/keyboard/page.ui`
            }, _KeyboardPage);
        }

        if (!ProfilesPage) {
            ProfilesPage = GObject.registerClass({
                GTypeName: "DeskChangerUiPrefsProfilesPage",
                InternalChildren: [
                    'combo_row_profiles',
                    'locations_listview',
                    'locations_selection',
                    'remove_item_button',
                    'remove_profile_button',
                ],
                Template: `resource://${APP_PATH}/ui/prefs/profiles_page.ui`
            }, _ProfilesPage);
        }

        this.#load_profiles();
        this.#profiles_page = new ProfilesPage(this.#profiles!, this.#current_profile_index!, this.#settings!);
        window.add(this.#profiles_page);
        window.add(new KeyboardPage());
        window.add(new ExtensionPage(this.#profiles!, this.#current_profile_index!, this.#settings!));
        //window.add(new ServicePage());
        window.add(new AboutPage());

        window.connect('close-request', () => {
            // @ts-expect-error
            this.#profiles_page?.destroy();
            this.#profiles?.remove_all();
            this.#profiles = undefined;
            this.#settings = undefined;
            if (this.#resource)
                Gio.resources_unregister(this.#resource);
            this.#resource = undefined;
        });
    }

    #load_profiles() {
        const profiles = Object.entries(this.#settings!.get_value("profiles").deepUnpack<ProfileSettingsType>());
        const current_profile = this.#settings!.get_string("current-profile");

        if (!this.#profiles)
            this.#profiles = new Gio.ListStore<ProfileType>();

        this.#profiles.remove_all();
        for (let i = 0; i < profiles.length; i++) {
            const [name, _items] = profiles[i];

            if (current_profile === name)
                this.#current_profile_index = i;

            const items = new Gio.ListStore<ProfileItemType>;
            _items.forEach(item => items.append(new ProfileItem(item[0], item[1])));
            this.#profiles.append(new Profile(name, items));
        }
    }
}
