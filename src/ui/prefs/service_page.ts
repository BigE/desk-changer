import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import RotationModeListStore, {
    RotationModeObject,
} from './common/rotation_modes.js';
import MetaTypeRow from './common/meta_type_row.js';
import {SettingsAllowedMimeTypesType} from '../../common/settings.js';
import Service from '../../service/index.js';
import DeleteDialog from './dialog/delete.js';

export default class ServicePage extends Adw.PreferencesPage {
    allowed_mime_types_listbox: Gtk.ListBox;
    allowed_mime_types_reset_button: Gtk.Button;
    #button_add?: Gtk.Button;
    #button_add_clicked_id?: number;
    daemon_auto_start_switch: Adw.SwitchRow;
    daemon_remember_profile_state_switch: Adw.SwitchRow;
    daemon_running_switch: Adw.SwitchRow;
    gamemode_switch: Adw.SwitchRow;
    #is_in_callback = false;
    #logger?: Console;
    #mime_rows: {mime_row: MetaTypeRow; signal_id: number}[];
    #proxy?: Gio.DBusProxy;
    #proxy_preview_binding?: GObject.Binding;
    random_switch: Adw.SwitchRow;
    rotation_custom_interval_spinner: Adw.SpinRow;
    rotation_mode_combo: Adw.ComboRow;
    #rotation_mode_combo_notify_id?: number;
    #rotation_position?: number;
    #settings?: Gio.Settings;

    constructor(
        settings: Gio.Settings,
        logger: Console,
        params?: Partial<Adw.PreferencesPage.ConstructorProps>
    ) {
        super(params);

        this.#logger = logger;
        this.#mime_rows = [];
        this.#settings = settings;
        // @ts-expect-error Bind property from resource file
        this.allowed_mime_types_listbox = this._allowed_mime_types_listbox;
        this.allowed_mime_types_reset_button =
            // @ts-expect-error Bind property from resource file
            this._allowed_mime_types_reset_button;
        // @ts-expect-error Bind property from resource file
        this.daemon_auto_start_switch = this._daemon_auto_start_switch;
        this.daemon_remember_profile_state_switch =
            // @ts-expect-error Bind property from resource file
            this._daemon_remember_profile_state_switch;
        // @ts-expect-error Bind property from resource file
        this.daemon_running_switch = this._daemon_running_switch;
        // @ts-expect-error Bind property from resource file
        this.gamemode_switch = this._gamemode_switch;
        // @ts-expect-error Bind property from resource file
        this.random_switch = this._random_switch;
        this.rotation_custom_interval_spinner =
            // @ts-expect-error Bind property from resource file
            this._rotation_custom_interval_spinner;
        // @ts-expect-error Bind property from resource file
        this.rotation_mode_combo = this._rotation_mode_combo;

        try {
            const DBusProxyWrapper = Gio.DBusProxy.makeProxyWrapper(
                Service.getDBusInterfaceXML()
            );
            // @ts-expect-error No construct signature
            this.#proxy = new DBusProxyWrapper(
                Gio.DBus.session,
                Service.SERVICE_ID,
                Service.SERVICE_PATH
            );
        } catch (e) {
            this.#logger.error(e);
        }
    }

    destroy(): void {
        this.#disconnect_mime_rows_signals();
        this.#logger = undefined;
        this.#proxy = undefined;
        this.#settings = undefined;
    }

    vfunc_realize() {
        super.vfunc_realize();

        this.#settings!.bind(
            'auto-start',
            this.daemon_auto_start_switch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.#settings!.bind(
            'gamemode-monitor',
            this.gamemode_switch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.#settings!.bind(
            'remember-profile-state',
            this.daemon_remember_profile_state_switch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.#settings!.bind(
            'random',
            this.random_switch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.#settings!.bind(
            'interval',
            this.rotation_custom_interval_spinner,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.#settings!.connect('changed::allowed-mime-types', () =>
            this.#load_mime_types()
        );
        this.daemon_running_switch.set_sensitive(
            Boolean(this.#proxy?.g_name_owner)
        );
        this.daemon_running_switch.set_active(Boolean(this.#proxy?.Running));
        this.#proxy?.connect('notify::g-name-owner', () => {
            this.daemon_running_switch.set_sensitive(
                Boolean(this.#proxy?.g_name_owner)
            );
        });
        this.#proxy?.connect('g-properties-changed', () => {
            if (!this.#proxy) return;
            this.#is_in_callback = true;
            this.daemon_running_switch.set_active(Boolean(this.#proxy.Running));
        });
        this.daemon_running_switch.connect('notify::active', () => {
            if (this.#is_in_callback || !this.#proxy) {
                this.#is_in_callback = false;
                return;
            }

            try {
                this.#is_in_callback = true;
                if (this.daemon_running_switch.get_active())
                    this.#proxy.StartSync();
                else this.#proxy.StopSync();
            } catch (e) {
                this.#logger?.error(e);
            }

            this.daemon_running_switch.set_active(Boolean(this.#proxy.Running));
        });
        this.rotation_mode_combo.set_model(new RotationModeListStore());
        this.#load_mime_types();

        this.#rotation_mode_combo_notify_id = this.rotation_mode_combo.connect(
            'notify::selected-item',
            () => {
                const mode =
                    this.rotation_mode_combo.get_selected_item<RotationModeObject>();

                this.#settings?.set_string('rotation', mode.mode);
                if (mode.mode === 'interval')
                    this.rotation_custom_interval_spinner.show();
                else this.rotation_custom_interval_spinner.hide();
            }
        );

        if (this.#rotation_position)
            this.rotation_mode_combo.set_selected(this.#rotation_position);

        if (this.#settings?.get_string('rotation') === 'interval')
            this.rotation_custom_interval_spinner.show();
    }

    vfunc_unrealize() {
        if (this.#proxy_preview_binding) {
            this.#proxy_preview_binding.unbind();
            this.#proxy_preview_binding = undefined;
        }

        if (this.#button_add_clicked_id) {
            this.#button_add!.disconnect(this.#button_add_clicked_id);
            this.#button_add_clicked_id = undefined;
        }

        if (this.#rotation_mode_combo_notify_id) {
            this.rotation_mode_combo.disconnect(
                this.#rotation_mode_combo_notify_id
            );
            this.#rotation_mode_combo_notify_id = undefined;
        }

        this.#button_add = undefined;
        this.#disconnect_mime_rows_signals();
        super.vfunc_unrealize();
    }

    _on_allowed_mime_types_reset_button_clicked() {
        this.#settings!.reset('allowed-mime-types');
    }

    _on_allowed_mime_types_add_button_clicked() {
        const dialog = new Adw.AlertDialog({
            heading: 'Add new MIME type',
            title: 'Allowed MIME types',
        });
        dialog.add_response('add', 'Add');
        dialog.add_response('close', 'Cancel');
        dialog.set_default_response('add');
        dialog.set_close_response('close');
        dialog.set_extra_child(new Adw.EntryRow({activates_default: true}));
        dialog.choose(this.get_root(), null, (_dialog, result) => {
            const response = dialog.choose_finish(result);
            const new_mime_type = (
                dialog.get_extra_child() as Adw.EntryRow
            ).get_text();

            if (response === 'add' && new_mime_type) {
                const allowed_mime_type =
                    this.#settings!.get_value(
                        'allowed-mime-types'
                    ).deepUnpack<SettingsAllowedMimeTypesType>();
                allowed_mime_type.push(new_mime_type);
                this.#settings!.set_value(
                    'allowed-mime-types',
                    new GLib.Variant('as', allowed_mime_type)
                );
            }
        });
    }

    _on_allowed_mime_types_delete_button_clicked(meta_row: MetaTypeRow) {
        const mime_type = meta_row.get_title();
        const dialog = new DeleteDialog({
            body: `Are you sure you want to delete mime type ${mime_type}`,
            body_use_markup: true,
        });

        dialog.choose(this.get_root(), null, (_dialog, result) => {
            const response = _dialog?.choose_finish(result);

            if (response === 'yes') {
                const allowed_mime_type =
                    this.#settings!.get_value(
                        'allowed-mime-types'
                    ).deep_unpack<SettingsAllowedMimeTypesType>();
                const indexOfMime = allowed_mime_type.indexOf(mime_type);
                if (indexOfMime > -1) {
                    allowed_mime_type.splice(indexOfMime, 1);
                    this.#settings!.set_value(
                        'allowed-mime-types',
                        new GLib.Variant('as', allowed_mime_type)
                    );
                }
            }
        });
    }

    _on_rotation_mode_combo_factory_bind(
        _widget: Gtk.SignalListItemFactory,
        item: Gtk.ListItem
    ) {
        const label = (item.get_child() as Gtk.Label) || null;
        const rotation_mode = item.get_item<RotationModeObject>();

        if (!label) return;

        label.set_label(rotation_mode.label);

        if (rotation_mode.mode === this.#settings?.get_string('rotation'))
            this.#rotation_position = item.get_position();
    }

    _on_rotation_mode_combo_factory_setup(
        _widget: Gtk.SignalListItemFactory,
        item: Gtk.ListItem
    ) {
        item.set_child(new Gtk.Label());
    }

    #disconnect_mime_rows_signals() {
        for (const row of this.#mime_rows) {
            const {mime_row, signal_id} = row;

            mime_row.disconnect(signal_id);
        }

        this.#mime_rows = [];
    }

    #load_mime_types() {
        if (this.#button_add_clicked_id) {
            this.#button_add!.disconnect(this.#button_add_clicked_id);
            this.#button_add_clicked_id = undefined;
        }

        this.#button_add = undefined;
        this.#disconnect_mime_rows_signals();
        this.allowed_mime_types_listbox.remove_all();

        this.#button_add = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            css_classes: ['flat'],
        });
        this.#button_add_clicked_id = this.#button_add.connect('clicked', () =>
            this._on_allowed_mime_types_add_button_clicked()
        );
        this.allowed_mime_types_listbox.append(this.#button_add);
        this.allowed_mime_types_reset_button.set_visible(
            Boolean(this.#settings?.get_user_value('allowed-mime-types'))
        );
        this.#settings!.get_strv('allowed-mime-types').forEach(mime_type => {
            const mime_row = new MetaTypeRow({title: mime_type});

            this.allowed_mime_types_listbox.append(mime_row);
            this.#mime_rows.push({
                mime_row: mime_row,
                signal_id: mime_row.connect(
                    'delete-clicked',
                    (widget: MetaTypeRow) =>
                        this._on_allowed_mime_types_delete_button_clicked(
                            widget
                        )
                ),
            });
        });
    }
}
