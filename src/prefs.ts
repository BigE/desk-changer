import Adw from "gi://Adw";
import Gio from "gi://Gio";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import _AboutPage from "./ui/prefs/about_page.js";
import _ExtensionPage from "./ui/prefs/extension_page.js";
import _KeyboardPage from "./ui/prefs/keyboard_page.js";
import _ProfilesPage from "./ui/prefs/profiles_page.js";
import _ServicePage from "./ui/prefs/service_page.js";
import {APP_ID, APP_PATH} from "./common/interface.js";
import GObject from "gi://GObject";

export default class DeskChangerPreferences extends ExtensionPreferences {
    #settings?: Gio.Settings;

    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const resources = Gio.Resource.load(`${this.path}/${APP_ID}.gresource`);
        Gio.resources_register(resources);
        this.#settings = this.getSettings();

        const ProfilesPage = GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsProfilesPage",
            Template: `resource://${APP_PATH}/ui/prefs/profiles_page.ui`
        }, _ProfilesPage);

        const KeyboardPage = GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsKeyboardPage",
            Template: `resource://${APP_PATH}/ui/prefs/keyboard/page.ui`
        }, _KeyboardPage);

        const ExtensionPage = GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsExtensionPage",
            Template: `resource://${APP_PATH}/ui/prefs/extension_page.ui`
        }, _ExtensionPage);

        const ServicePage = GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsServicePage",
            Template: `resource://${APP_PATH}/ui/prefs/service_page.ui`
        }, _ServicePage);

        const AboutPage = GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsAboutPage",
            Template: `resource://${APP_PATH}/ui/prefs/about_page.ui`
        }, _AboutPage);

        window.add(new ProfilesPage());
        window.add(new KeyboardPage());
        window.add(new ExtensionPage());
        window.add(new ServicePage());
        window.add(new AboutPage());

        return Promise.resolve().then(() => Gio.resources_unregister(resources));
    }
}
