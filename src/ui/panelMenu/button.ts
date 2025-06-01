import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import PanelMenuIcon from "./icon.js";
import PopupMenuProfile from "../popupMenu/profile.js";
import PreviewMenuItem from "../popupMenu/preview_menu_item.js";
import ControlsMenuItem from "../popupMenu/controls_menu_item.js";
import OpenCurrentMenuItem from "../popupMenu/open_current_menu_item.js";
import Service from "../../service/index.js";

export default class PanelMenuButton extends PanelMenu.Button {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPanelMenuButton",
        }, this);
    }

    declare menu: PopupMenu.PopupMenu;
    #icon?: PanelMenuIcon;
    #profile_menu_item?: PopupMenuProfile;
    #profile_menu_item_profile_activate_id?: number;
    #settings_menu_item?: PopupMenu.PopupMenuItem;
    #settings_activate_id?: number;
    #service_preview_binding?: GObject.Binding;
    #service_preview_menu_item_binding?: GObject.Binding;

    constructor(uuid: string, settings: Gio.Settings, service: Service, callback: () => void) {
        super(0.0, uuid);

        this.#icon = new PanelMenuIcon();
        settings.bind('icon-preview', this.#icon, 'preview_enabled', Gio.SettingsBindFlags.GET);
        this.#service_preview_binding = service.bind_property('Preview', this.#icon, 'preview', GObject.BindingFlags.SYNC_CREATE);
        this.add_child(this.#icon);

        // Now load in the menu itself
        // profiles
        this.#profile_menu_item = new PopupMenuProfile({profiles: settings.get_value("profiles")});
        settings.bind('current-profile', this.#profile_menu_item, 'profile', Gio.SettingsBindFlags.GET);
        settings.bind_with_mapping("profiles", this.#profile_menu_item, "profiles", Gio.SettingsBindFlags.GET, (value, variant) => {
            // according to the g_settings_bind_with_mapping the value is
            // supposed to be an assignable reference here and then that gets
            // set to the object property. however, there is no way to set the
            // value here since it is passed in as null and that isn't a
            // reference in JS. this is a dirty nasty hack.
            const source = setTimeout(() => {
                if (!this.#profile_menu_item)
                    return;
                this.#profile_menu_item.profiles = settings.get_value("profiles");
                source.destroy();
            }, 50);
            return true;
        }, null);
        this.#profile_menu_item_profile_activate_id = this.#profile_menu_item.connect(
            'profile-activate',
            (_menu: PopupMenuProfile, element: PopupMenu.PopupMenuItem, _event: any) => {
                settings.set_string("current-profile", element.label.get_text());
            }
        );
        this.menu.addMenuItem(this.#profile_menu_item);
        // end profiles
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // controls
        const preview_menu_item = new PreviewMenuItem();
        this.#service_preview_menu_item_binding = service.bind_property(
            'Preview',
            preview_menu_item,
            'preview',
            GObject.BindingFlags.SYNC_CREATE
        );
        this.menu.addMenuItem(preview_menu_item);
        this.menu.addMenuItem(new ControlsMenuItem(service, settings));
        this.menu.addMenuItem(new OpenCurrentMenuItem());
        // end controls
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // settings
        this.#settings_menu_item = new PopupMenu.PopupMenuItem("DeskChanger Settings");
        this.#settings_activate_id = this.#settings_menu_item.connect('activate', () => callback());
        this.menu.addMenuItem(this.#settings_menu_item);
        // end settings
    }

    destroy() {
        if (this.#service_preview_menu_item_binding) {
            this.#service_preview_menu_item_binding.unbind();
            this.#service_preview_menu_item_binding = undefined;
        }

        if (this.#profile_menu_item_profile_activate_id) {
            this.#profile_menu_item!.disconnect(this.#profile_menu_item_profile_activate_id);
            this.#profile_menu_item_profile_activate_id = undefined;
        }

        this.#profile_menu_item?.destroy();
        this.#profile_menu_item = undefined;

        if (this.#service_preview_binding) {
            this.#service_preview_binding.unbind();
            this.#service_preview_binding = undefined;
        }

        if (this.#settings_activate_id) {
            this.#settings_menu_item!.disconnect(this.#settings_activate_id);
            this.#settings_activate_id = undefined;
        }

        this.#settings_menu_item?.destroy();
        this.#settings_menu_item = undefined;

        this.#icon?.destroy();
        this.#icon = undefined;
        super.destroy();
    }
}
