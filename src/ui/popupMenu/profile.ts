import Gio from "gi://Gio";
import GObject from "gi://GObject";

import PopupMenuItem from "./popup_menu_item.js";
import PopupSubMenuMenuItem from "./popup_sub_menu_menu_item.js";
import {SettingsProfileType} from "../../common/settings.js";

export default class PopupMenuProfile extends PopupSubMenuMenuItem {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPopupMenuProfile",
        }, this);
    }

    #profiles_changed_id?: number;
    #settings?: Gio.Settings;

    constructor(settings: Gio.Settings, sensitive: boolean = true) {
        super(settings, 'Profile', 'current-profile', sensitive);

        this.#settings = settings;
        this.#populate_profiles();
        this.#profiles_changed_id = this.#settings.connect('changed::profiles', () => {
            this.#populate_profiles();
        });
    }

    destroy() {
        if (this.#profiles_changed_id && this.#settings) {
            this.#settings.disconnect(this.#profiles_changed_id);
            this.#profiles_changed_id = undefined;
        }

        this.#settings = undefined;
        super.destroy();
    }

    #populate_profiles() {
        this.menu.removeAll();
        for (let index in this.#settings!.get_value('profiles').deepUnpack<SettingsProfileType>()) {
            this.menu.addMenuItem(new PopupMenuItem(this.#settings!, index, index, 'current-profile'));
        }
    }
}
