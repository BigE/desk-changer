import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import RotationModeListStore, {RotationModeObject} from "./common/rotation_modes.js";
import MetaTypeRow from "./common/meta_type_row.js";

export default class ServicePage extends Adw.PreferencesPage {
    allowed_mime_types_listbox: Gtk.ListBox;
    allowed_mime_types_reset_button: Gtk.Button;
    #button_add?: Gtk.Button;
    #button_add_clicked_id?: number;
    daemon_auto_start_switch: Adw.SwitchRow;
    daemon_remember_profile_state_switch: Adw.SwitchRow;
    daemon_running_switch: Adw.SwitchRow;
    rotation_custom_interval_spinner: Adw.SpinRow;
    rotation_mode_combo: Adw.ComboRow;
    #rotation_mode_combo_notify_id?: number;
    #settings?: Gio.Settings;

    constructor(settings: Gio.Settings, params?: Partial<Adw.PreferencesPage.ConstructorProps>) {
        super(params);

        this.#settings = settings;
        // @ts-expect-error
        this.allowed_mime_types_listbox = this._allowed_mime_types_listbox;
        // @ts-expect-error
        this.allowed_mime_types_reset_button = this._allowed_mime_types_reset_button;
        // @ts-expect-error
        this.daemon_auto_start_switch = this._daemon_auto_start_switch;
        // @ts-expect-error
        this.daemon_remember_profile_state_switch = this._daemon_remember_profile_state_switch;
        // @ts-expect-error
        this.daemon_running_switch = this._daemon_running_switch;
        // @ts-expect-error
        this.rotation_custom_interval_spinner = this._rotation_custom_interval_spinner;
        // @ts-expect-error
        this.rotation_mode_combo = this._rotation_mode_combo;
    }

    destroy(): void {
        this.#settings = undefined;
    }

    vfunc_realize() {
        super.vfunc_realize();

        this.#settings!.bind('auto-start', this.daemon_auto_start_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.#settings!.bind('remember-profile-state', this.daemon_remember_profile_state_switch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.#settings!.bind('interval', this.rotation_custom_interval_spinner, 'value', Gio.SettingsBindFlags.DEFAULT);
        this.rotation_mode_combo.set_model(new RotationModeListStore());
        this.#load_mime_types();

        this.#rotation_mode_combo_notify_id = this.rotation_mode_combo.connect('notify::selected-item', () => {
            this.#settings?.set_string('rotation', this.rotation_mode_combo.get_selected_item<RotationModeObject>().mode);
        });
    }

    vfunc_unrealize() {
        if (this.#button_add_clicked_id) {
            this.#button_add!.disconnect(this.#button_add_clicked_id);
            this.#button_add_clicked_id = undefined;
        }

        if (this.#rotation_mode_combo_notify_id) {
            this.rotation_mode_combo.disconnect(this.#rotation_mode_combo_notify_id);
            this.#rotation_mode_combo_notify_id = undefined;
        }

        this.#button_add = undefined;
        super.vfunc_unrealize();
    }

    _on_allowed_mime_types_reset_button_clicked() {
        this.#settings!.reset("allowed-mime-types");
    }

    _on_allowed_mime_types_add_button_clicked() {
    }

    _on_rotation_mode_combo_factory_bind(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        const label = (item.get_child() as Gtk.Label) || null;
        const rotation_mode = item.get_item<RotationModeObject>();

        if (!label)
            return;

        label.set_label(rotation_mode.label);

        if (rotation_mode.mode === this.#settings?.get_string('rotation'))
            this.rotation_mode_combo.set_selected(item.get_position());
    }

    _on_rotation_mode_combo_factory_setup(_widget: Gtk.SignalListItemFactory, item: Gtk.ListItem) {
        item.set_child(new Gtk.Label());
    }

    #load_mime_types() {
        if (this.#button_add_clicked_id) {
            this.#button_add!.disconnect(this.#button_add_clicked_id);
            this.#button_add_clicked_id = undefined;
        }

        this.#button_add = undefined;
        this.allowed_mime_types_listbox.remove_all();

        this.#button_add = new Gtk.Button({icon_name: 'list-add-symbolic', css_classes: ['flat']});
        this.#button_add_clicked_id = this.#button_add.connect('clicked', () => this._on_allowed_mime_types_add_button_clicked());
        this.allowed_mime_types_listbox.append(this.#button_add);
        this.allowed_mime_types_reset_button.set_visible(Boolean(this.#settings?.get_user_value('allowed-mime-types')));
        this.#settings!.get_strv('allowed-mime-types').forEach(mime_type => this.allowed_mime_types_listbox.append(new MetaTypeRow({title: mime_type})));
    }
}
