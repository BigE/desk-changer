'use strict';

const {Gio, GObject, Gtk} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
Me.imports._deskchanger;
const _ = deskchanger._;

const PrefsWidget = GObject.registerClass({
    GTypeName: 'PrefsWidget',
    InternalChildren: [
        'buffer_allowed_mime_types',
        'combo_profiles',
        'combo_current_profile',
        'combo_rotation',
        'locations',
        'spinner_interval',
        'switch_auto_start_daemon',
        'switch_daemon_status',
        'switch_icon_as_preview',
        'switch_notifications',
        'switch_remember_profile',
    ],
    Template: Me.dir.get_child('prefs.ui').get_uri(),
},
class PrefsWidget extends Gtk.Box {
    _init(params = {}) {
        super._init(params);

        this._load_profiles(this._combo_profiles);
        this._load_profiles(this._combo_current_profile);
        let mime_types = deskchanger.settings.allowed_mime_types.join("\n");
        this._buffer_allowed_mime_types.set_text(mime_types, mime_types.length);

        deskchanger.settings.bind('auto-start', this._switch_auto_start_daemon, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('icon-preview', this._switch_icon_as_preview, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('interval', this._spinner_interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('notifications', this._switch_notifications, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('remember-profile-state', this._switch_remember_profile, 'active', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.bind('rotation', this._combo_rotation, 'active-id', Gio.SettingsBindFlags.DEFAULT);
        deskchanger.settings.connect('changed::allowed-mime-types', () => {
            let mime_types = deskchanger.settings.allowed_mime_types.join("\n");
            this._buffer_allowed_mime_types.set_tex(mime_types, mime_types.length);
        });
    }

    _load_profiles(_combobox, text=null) {
        let active = _combobox.get_active(),
            i = 0;

        if (!text) {
            text = _combobox.get_active_text();
        }

        _combobox.remove_all();

        for (let profile in deskchanger.settings.profiles) {
            _combobox.insert_text(i, profile);

            if (text === profile || (active === -1 && profile === deskchanger.settings.current_profile)) {
                _combobox.set_active(i);
            }

            i++;
        }
    }

    _on_add_profile() {
        let dialog = new Gtk.Dialog(),
            mbox = dialog.get_content_area(),
            box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
            label = new Gtk.Label({label: _('Profile Name')}),
            input = new Gtk.Entry();

        box.append(label);
        box.append(input);
        mbox.append(box);
        dialog.add_button(_('OK'), Gtk.ResponseType.OK);
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.connect('response', (result) => {
            if (result === Gtk.ResponseType.OK) {
                let _profiles = deskchanger.settings.profiles;
                _profiles[input.get_text()] = [];
                deskchanger.settings.profiles = _profiles;
                this._load_profiles(this._combo_profiles, input.get_text());
            }
            dialog.destroy();
        });
        dialog.show();
    }

    _on_current_profile_changed(_combobox) {
        let _profile = _combobox.get_active_text();

        if (deskchanger.settings.current_profile !== _profile) {
            deskchanger.settings.current_profile = _profile;
        }
    }

    _on_profile_changed(_combobox) {
        for (let profile in deskchanger.settings.profiles) {
            if (profile === _combobox.get_active_text()) {
                this._locations.clear();

                for (let location in deskchanger.settings.profiles[profile]) {
                    let iter = this._locations.append();
                    this._locations.set_value(iter, 0, deskchanger.settings.profiles[profile][location][0]);
                    this._locations.set_value(iter, 1, deskchanger.settings.profiles[profile][location][1]);
                }

                break;
            }
        }
    }

    _on_recursive_toggled(_widget, _path) {
        let _iter = this._locations.get_iter_from_string(_path)[1],
            _profiles = deskchanger.settings.profiles;

        this._locations.set_value(_iter, 1, !this._locations.get_value(_iter, 1));
        _profiles[this._combo_profiles.get_active_text()][_path][1] = Boolean(this._locations.get_value(_iter, 1));
        deskchanger.settings.profiles = _profiles;
        this._load_profiles(this._combo_profiles);
    }

    _on_remove_profile() {
    }

    _on_buffer_allowed_mime_types_changed() {
        deskchanger.settings.allowed_mime_types = this._buffer_allowed_mime_types.get_text(this._buffer_allowed_mime_types.get_start_iter(), this._buffer_allowed_mime_types.get_end_iter(), false);
    }
});

function init() {
    ExtensionUtils.initTranslations('desk-changer');
}

function buildPrefsWidget() {
    return new PrefsWidget();
}
