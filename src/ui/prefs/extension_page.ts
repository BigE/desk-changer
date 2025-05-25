import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import {ProfileType} from "../../common/profile/index.js";

type CurrentProfileComboType = Adw.ComboRow & {
    selected_item: ProfileType | null;
};

export default class ExtensionPage extends Adw.PreferencesPage {
    current_profile_combo: CurrentProfileComboType;
    icon_preview_switch: Adw.SwitchRow;
    notifications_switch: Adw.SwitchRow;
    readonly #settings: Gio.Settings;
    #selected_changed_id?: number;

    constructor(profiles: Gio.ListStore<ProfileType>, current_profile_index: number, settings: Gio.Settings) {
        super();

        // @ts-expect-error
        this.current_profile_combo = this._current_profile_combo;
        // @ts-expect-error
        this.icon_preview_switch = this._icon_preview_switch;
        // @ts-expect-error
        this.notifications_switch = this._notifications_switch;

        this.current_profile_combo.set_model(profiles);
        this.current_profile_combo.set_selected(current_profile_index);

        this.#settings = settings;
        this.#settings.bind('icon-preview', this.icon_preview_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.#settings.bind('notifications', this.notifications_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.#selected_changed_id = this.current_profile_combo.connect('notify::selected-item', () => {
            this.#settings.set_string('current-profile', this.current_profile_combo.selected_item.name);
        });
    }

    destroy() {
        if (this.#selected_changed_id) {
            this.current_profile_combo.disconnect(this.#selected_changed_id);
            this.#selected_changed_id = undefined;
        }
    }

    _on_current_profile_combo_factory_bind(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        const label = item.get_child() as Gtk.Label,
            profile = item.get_item<ProfileType>();

        label.set_label(profile.name);
    }

    _on_current_profile_combo_factory_setup(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        item.set_child(new Gtk.Label());
    }
}
