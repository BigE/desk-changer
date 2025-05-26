import Gio from "gi://Gio";
import GObject from "gi://GObject";

import PopupMenuItem from "./popup_menu_item.js";
import PopupMenuMenuItemSubMenu from "./sub_menu.js";
import ProfileSettingsType from "../../common/profile/settings.js";

const PopupMenuProfile = GObject.registerClass(
class DeskChangerUiPopupMenuProfile extends PopupMenuMenuItemSubMenu {
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
        for (let index in this.#settings!.get_value('profiles').deepUnpack<ProfileSettingsType>()) {
            this.menu.addMenuItem(new PopupMenuItem(this.#settings!, index, index, 'current-profile'));
        }
    }
}
);

export default PopupMenuProfile;
export type PopupMenuProfileType = InstanceType<typeof PopupMenuItem>;
