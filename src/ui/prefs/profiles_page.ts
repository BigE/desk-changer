import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"

import Profile from "../../common/profile/index.js";
import ProfileItem from "../../common/profile/item.js";
import {SettingsProfileType, SettingsProfileItemType, SettingsProfileState} from "../../common/settings.js";
import DeleteDialog from "./dialog/delete.js";

type ComboRowProfilesType = Omit<Adw.ComboRow, 'get_model' | 'model' | 'selected_item'> & {
    model: Gio.ListStore<Profile> | null;
    selected_item: Profile;
    get_model(): Gio.ListStore<Profile> | null;
};

type LocationSelectionType = Omit<Gtk.SingleSelection<ProfileItem>, 'selected_item'> & {
    model: Gio.ListStore<ProfileItem> | null;
    selected_item: ProfileItem | null;
};

export default class DeskChangerUiPrefsProfilesPage extends Adw.PreferencesPage {
    private combo_row_profiles: ComboRowProfilesType;
    #combo_row_profiles_selected_item_id?: number;
    #destroy_id?: number;
    private locations_listview: Gtk.ListView;
    private locations_selection: LocationSelectionType;
    private remove_item_button: Gtk.Button;
    private remove_profile_button: Gtk.Button;
    readonly #settings;

    constructor(profiles: Gio.ListStore<Profile>, current_profile: number, settings: Gio.Settings) {
        super();
        this.#settings = settings;

        // @ts-expect-error
        this.combo_row_profiles = this._combo_row_profiles;
        // @ts-expect-error
        this.locations_listview = this._locations_listview;
        // @ts-expect-error
        this.locations_selection = this._locations_selection;
        // @ts-expect-error
        this.remove_item_button = this._remove_item_button;
        // @ts-expect-error
        this.remove_profile_button = this._remove_profile_button;

        this.combo_row_profiles.set_model(profiles);
        this.combo_row_profiles.set_selected(current_profile);
        this.locations_selection.set_model(this.combo_row_profiles.selected_item.items);
        this.remove_item_button.set_sensitive(this.combo_row_profiles.selected_item.items.get_n_items() > 1);
        this.remove_profile_button.set_sensitive(profiles.get_n_items() > 1);

        this.#combo_row_profiles_selected_item_id = this.combo_row_profiles.connect('notify::selected-item', () => {
            const profile = this.#find_profile_by_name(this.combo_row_profiles.get_selected_item<Profile>().name);

            if (profile)
                this.locations_selection.set_model(profile.items);

            this.remove_profile_button.set_sensitive(this.combo_row_profiles.get_model()!.get_n_items() > 1);
        });
    }

    destroy() {
        if (this.#combo_row_profiles_selected_item_id) {
            this.combo_row_profiles.disconnect(this.#combo_row_profiles_selected_item_id);
            this.#combo_row_profiles_selected_item_id = undefined;
        }

        if (this.#destroy_id) {
            this.disconnect(this.#destroy_id);
            this.#destroy_id = undefined;
        }
    }

    _on_add_folder_button_clicked() {
        const dialog = new Gtk.FileDialog();

        dialog.set_title("Add Folder(s)");
        dialog.select_multiple_folders(this.get_root() as Adw.Window, null, (_dialog, response) => {
            const items = dialog.select_multiple_folders_finish(response);

            if (items)
                this._on_dialog_add_items_response(items as Gio.ListModel<Gio.File>);
        });
    }

    _on_add_item_button_clicked() {
        const dialog: Gtk.FileDialog = new Gtk.FileDialog();

        dialog.set_title("Add Image(s)");
        dialog.open_multiple(this.get_root() as Adw.Window, null, (_dialog, response) => {
            const items = dialog.open_multiple_finish(response);

            if (items)
                this._on_dialog_add_items_response(items as Gio.ListModel<Gio.File>);
        });
    }

    _on_add_profile_button_clicked() {
        const dialog = new Adw.AlertDialog();
        const entry = new Adw.EntryRow();
        const dialog_response_id = dialog.connect('response', (_dialog, response) => {
            const profile_name = (_dialog.get_extra_child()! as Adw.EntryRow).get_text();

            if (profile_name.length === 0)
                return;

            let profiles = this.#settings.get_value("profiles").deepUnpack<SettingsProfileType>();

            if (!(profile_name in profiles)) {
                profiles[profile_name] = [];
                this.#settings.set_value("profiles", new GLib.Variant('a{sa(sb)}', profiles));
                this.combo_row_profiles.get_model()!.append(new Profile(profile_name));
                this.combo_row_profiles.set_selected(this.combo_row_profiles.get_model()!.get_n_items() - 1);
            } else {
                const profile = this.#find_profile_by_name(profile_name);

                if (!profile)
                    return;

                const [success, index] = this.combo_row_profiles.get_model()!.find(profile);
                success && this.combo_row_profiles.set_selected(index);
            }

        });

        dialog.set_title("Add Profile");
        dialog.set_body("Enter your new profile name below");
        dialog.set_extra_child(entry);
        entry.set_activates_default(true);
        dialog.add_response('add', 'Add');
        dialog.set_default_response('add');
        dialog.choose(this.get_root(), null, () => {
            dialog.disconnect(dialog_response_id);
        });
    }

    _on_dialog_add_items_response(items: Gio.ListModel<Gio.File>) {
        const length = items.get_n_items();
        let profiles = this.#settings.get_value("profiles").deepUnpack<SettingsProfileType>();

        for (let i = 0; i < length; i++) {
            const item: SettingsProfileItemType = [items.get_item(i)!.get_uri(), false];
            profiles[this.combo_row_profiles.selected_item.name].push(item);
            (this.locations_selection.get_model()! as Gio.ListStore).append(new ProfileItem(item[0], item[1]));
        }

        this.remove_item_button.set_sensitive(this.locations_listview.get_model()!.get_n_items() > 1);
        this.#settings.set_value("profiles", new GLib.Variant('a{sa(sb)}', profiles));
    }

    _on_factory_row_profiles_bind(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        const label = item.get_child() as Gtk.Label,
            profile = item.get_item<Profile>();

        label.set_label(profile.name);
    }

    _on_factory_row_profiles_setup(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        item.set_child(new Gtk.Label());
    }

    _on_locations_header_factory_setup(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        const box = new Gtk.Box({
            margin_end: 12,
            margin_start: 12,
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });

        box.append(new Gtk.Label({
            halign: Gtk.Align.START,
            hexpand: true,
            label: _("<b>Location</b>"),
            use_markup: true,
        }));
        box.append(new Gtk.Label({
            halign: Gtk.Align.END,
            label: _("<b>Recursive</b>"),
            use_markup: true,
        }));
        item.set_child(box);
    }

    _on_locations_factory_bind(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        const row = item.get_child() as Adw.SwitchRow,
            location = item.get_item<ProfileItem>();

        row.set_title(location.uri);
        row.set_active(location.recursive);
        row.connect('notify::active', (object: Adw.SwitchRow) => {
            let profiles = this.#settings.get_value("profiles").deepUnpack<SettingsProfileType>();
            const profile = (this.combo_row_profiles.selected_item as Profile).name;
            const index = profiles[profile].findIndex(element => element[0] === object.title);

            profiles[profile][index][1] = object.active;
            this.combo_row_profiles.selected_item.items.get_item(index)!.recursive = object.active;
            this.#settings.set_value("profiles", new GLib.Variant('a{sa(sb)}', profiles));
        });
    }

    _on_locations_factory_setup(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        item.set_child(new Adw.SwitchRow());
    }

    _on_remove_item_button_clicked() {
        if (!this.locations_selection.selected_item)
            return;

        const dialog = new DeleteDialog();
        const dialog_response_id = dialog.connect('response', (_dialog, response) => {
            if (response === 'no') return;

            let profiles = this.#settings.get_value("profiles").deepUnpack<SettingsProfileType>();
            let profile = profiles[this.combo_row_profiles.selected_item.name];
            const index = profile.findIndex(element =>
                element[0] === this.locations_selection.selected_item!.uri &&
                element[1] === this.locations_selection.selected_item!.recursive);

            if (index === -1) return;

            profile.splice(index, 1);
            this.combo_row_profiles.selected_item.items.remove(index);
            profiles[this.combo_row_profiles.selected_item.name] = profile;
            this.#settings.set_value("profiles", new GLib.Variant("a{sa(sb)}", profiles));
            this.remove_item_button.set_sensitive(this.combo_row_profiles.selected_item.items.get_n_items() > 1);
        });

        dialog.set_title(`Remove profile item`);
        dialog.set_body(`Are you sure you want to remove ` +
                        `"${this.locations_selection.selected_item.uri}" from ` +
                        `${this.combo_row_profiles.selected_item.name}?`);
        dialog.choose(this.get_root(), null, () => {
            dialog.disconnect(dialog_response_id);
        });
    }

    _on_remove_profile_button_clicked() {
        const dialog = new DeleteDialog();
        const dialog_response_id = dialog.connect('response', (_dialog, response) => {
            if (response === 'no') return;

            let profiles = this.#settings.get_value("profiles").deepUnpack<SettingsProfileType>();
            delete profiles[this.combo_row_profiles.selected_item.name];
            this.#settings.set_value("profiles", new GLib.Variant("a{sa(sb)}", profiles));
            let profile_states = this.#settings.get_value("profile-states").deepUnpack<SettingsProfileState>();
            delete profile_states[this.combo_row_profiles.selected_item.name];
            this.#settings.set_value("profile-states", new GLib.Variant("a{sas}", profile_states));
            this.combo_row_profiles.get_model()!.remove(this.combo_row_profiles.get_selected());
        });

        dialog.set_title("Remove profile");
        dialog.set_body(`Are you sure you want to completely remove the profile ${this.combo_row_profiles.selected_item.name}?`);
        dialog.choose(this.get_root(), null, () => {
            dialog.disconnect(dialog_response_id);
        });
    }

    #find_profile_by_name(profile_name: string) {
        const model = this.combo_row_profiles.get_model()!;

        for (let i = 0; i < model.get_n_items(); i++) {
            const profile = model.get_item(i);
            if (profile && profile.name === profile_name)
                return profile;
        }

        return undefined;
    }
}
