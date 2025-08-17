import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {SettingsProfileType} from '../../common/settings.js';

export namespace PopupMenuProfile {
    export interface ConstructorProps {
        profile: string;
        profiles: GLib.Variant<'a{sa(sb)}'>;
    }
}

/**
 * Profile menu item for the button menu
 *
 * The profile menu item is an implementation of PopupSubMenuMenuItem. This
 * object will take the profile and profiles properties to set up the sub menu
 * that shows the currently selected profile. The label for the sub menu will
 * also update to show the current profile based on the profile property. When
 * a sub menu is activated, the profile-activate signal will be emitted and
 * the PopupMenuItem that triggered the event will be sent.
 */
export default class PopupMenuProfile extends PopupMenu.PopupSubMenuMenuItem {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPopupMenuProfile',
                Properties: {
                    profile: GObject.param_spec_string(
                        'profile',
                        'Profile',
                        'The name of the currently selected profile',
                        null,
                        GObject.ParamFlags.READWRITE
                    ),
                    profiles: GObject.param_spec_variant(
                        'profiles',
                        'Profiles',
                        'List of profiles for the dropdown menu',
                        new GLib.VariantType('a{sa(sb)}'),
                        null,
                        GObject.ParamFlags.READWRITE
                    ),
                },
                Signals: {
                    'profile-activate': {
                        param_types: [
                            PopupMenu.PopupMenuItem.$gtype,
                            Clutter.Event.$gtype,
                        ],
                    },
                },
            },
            this
        );
    }

    #profile: string | null;
    #profiles?: GLib.Variant<'a{sa(sb)}'>;

    get profile(): string | null {
        return this.#profile;
    }

    get profiles(): GLib.Variant<'a{sa(sb)}'> | null {
        return this.#profiles || null;
    }

    set profile(value: string | null) {
        this.#update_selected_item(this.#profile, value);
        this.#profile = value;
        this.#update_label_text();
        this.notify('profile');
    }

    set profiles(value: GLib.Variant<'a{sa(sb)}'> | null) {
        this.#profiles = value || undefined;
        this.#populate_profiles();
        this.notify('profiles');
    }

    constructor(parameters?: Partial<PopupMenuProfile.ConstructorProps>) {
        const {profile, profiles} = parameters || {};

        super(_('Profile'));

        this.#profile = profile || null;
        this.#update_label_text();
        this.#profiles = profiles;
        // only populate if we have a value, we don't need to call removeAll here
        if (this.#profiles) this.#populate_profiles();
    }

    destroy() {
        this.menu.removeAll();
        this.#profiles = undefined;
        super.destroy();
    }

    #populate_profiles() {
        this.menu.removeAll();

        if (!this.profiles) return;

        for (const profile_name in this.profiles.deepUnpack<SettingsProfileType>()) {
            const profile = new PopupMenu.PopupMenuItem(profile_name);
            if (profile_name === this.#profile)
                profile.setOrnament(PopupMenu.Ornament.DOT);
            profile.connect(
                'activate',
                (element: PopupMenu.PopupMenuItem, event: any) =>
                    this.emit('profile-activate', element, event)
            );
            this.menu.addMenuItem(profile);
        }
    }

    #update_label_text() {
        if (this.#profile)
            this.label.set_text(_('Profile: %s').format(this.#profile));
        else this.label.set_text(_('Profile'));
    }

    #update_selected_item(old_value: string | null, new_value: string | null) {
        let found_new = false,
            found_old = false;

        for (const menu_item of this.menu._getMenuItems() as PopupMenu.PopupMenuItem[]) {
            if (old_value && menu_item.label.get_text() === old_value) {
                menu_item.setOrnament(PopupMenu.Ornament.NONE);
                found_old = true;
            } else if (new_value && menu_item.label.get_text() === new_value) {
                menu_item.setOrnament(PopupMenu.Ornament.DOT);
                found_new = true;
            }

            // no sense in looping if we've done everything
            if ((!old_value || found_old) && (!new_value || found_new)) break;
        }
    }
}
