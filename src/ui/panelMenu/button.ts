import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import PanelMenuIcon from './icon.js';
import PopupMenuProfile from '../popupMenu/profile.js';
import PreviewMenuItem from '../popupMenu/preview_menu_item.js';
import ControlsMenuItem from '../popupMenu/controls_menu_item.js';
import OpenCurrentMenuItem from '../popupMenu/open_current_menu_item.js';

/**
 * Main indicator button for DeskChanger
 *
 * This is an interface between the extension/settings/service and the menu it
 * contains. All internal item properties that need to be bound to external
 * objects are exposed and bound here so the extension itself can manage the
 * binding between the necessary object. This also provides signals that expose
 * internal control signals for binding back to the service as well as a signal
 * to let the extension open the prefs with the built-in method.
 */
export default class PanelMenuButton extends PanelMenu.Button {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPanelMenuButton',
                Properties: {
                    icon_preview_enabled: GObject.param_spec_boolean(
                        'icon_preview_enabled',
                        'Icon preview enabled',
                        'If enabled the icon will turn into a preview of the next wallpaper',
                        false,
                        GObject.ParamFlags.READWRITE
                    ),
                    preview: GObject.param_spec_string(
                        'preview',
                        'Preview',
                        'Preview URI to be passed into the menu',
                        null,
                        GObject.ParamFlags.READWRITE
                    ),
                    profile: GObject.param_spec_string(
                        'profile',
                        'Profile',
                        'Current profile selected',
                        null,
                        GObject.ParamFlags.READWRITE
                    ),
                    profiles: GObject.param_spec_variant(
                        'profiles',
                        'Profiles',
                        'Profiles object to provide into the menu',
                        new GLib.VariantType('a{sa(sb)}'),
                        null,
                        GObject.ParamFlags.READWRITE
                    ),
                    random: GObject.param_spec_boolean(
                        'random',
                        'Random',
                        'Random flag for the controls in the menu',
                        true,
                        GObject.ParamFlags.READWRITE
                    ),
                    'service-running': GObject.ParamSpec.boolean(
                        'service-running',
                        'Service Running',
                        'Check if the service is running',
                        GObject.ParamFlags.READWRITE,
                        false
                    ),
                },
                Signals: {
                    'next-clicked': [],
                    'open-prefs': [],
                    'previous-clicked': [],
                },
            },
            this
        );
    }

    #bindings: GObject.Binding[];
    #controls_menu_item?: ControlsMenuItem;
    #icon?: PanelMenuIcon;
    #icon_preview_enabled: boolean;
    declare menu: PopupMenu.PopupMenu;
    #next_clicked_id?: number;
    #open_current_menu_item?: OpenCurrentMenuItem;
    #preferences_activate_id?: number;
    #preferences_menu_item?: PopupMenu.PopupMenuItem;
    #preview?: string;
    #preview_menu_item?: PreviewMenuItem;
    #previous_clicked_id?: number;
    #profile?: string;
    #profile_activate_id?: number;
    #profile_menu_item?: PopupMenuProfile;
    #profiles?: GLib.Variant<'a{sa(sb)}'>;
    #random: boolean;
    #service_running: boolean;

    get icon_preview_enabled(): boolean {
        return this.#icon_preview_enabled;
    }

    get preview(): string | null {
        return this.#preview || null;
    }

    get profile(): string | null {
        return this.#profile || null;
    }

    get profiles(): GLib.Variant<'a{sa(sb)}'> | null {
        return this.#profiles || null;
    }

    get random(): boolean {
        return this.#random;
    }

    get service_running() {
        return this.#service_running;
    }

    set icon_preview_enabled(value: boolean) {
        this.#icon_preview_enabled = value;
        this.notify('icon_preview_enabled');
    }

    set preview(value: string | null) {
        this.#preview = value || undefined;
        this.notify('preview');
    }

    set profile(value: string | null) {
        this.#profile = value || undefined;
        this.notify('profile');
    }

    set profiles(value: GLib.Variant<'a{sa(sb)}'> | null) {
        this.#profiles = value || undefined;
        this.notify('profiles');
    }

    set random(value: boolean) {
        this.#random = value;
        this.notify('random');
    }

    set service_running(value: boolean) {
        console.log(`button.service_running: ${value}`);
        this.#service_running = value;
        this.notify('service-running');
    }

    constructor(uuid: string) {
        super(0.0, uuid);

        this.#bindings = [];
        this.#icon_preview_enabled = false;
        this.#random = true;
        this.#service_running = false;
        // first set up the icon
        this.#icon = new PanelMenuIcon();
        this.#bindings.push(
            this.bind_property(
                'icon_preview_enabled',
                this.#icon,
                'preview_enabled',
                GObject.BindingFlags.SYNC_CREATE
            )
        );
        this.#bindings.push(
            this.bind_property(
                'preview',
                this.#icon,
                'preview',
                GObject.BindingFlags.SYNC_CREATE
            )
        );
        this.add_child(this.#icon);
        // now add the menu items, profile first
        this.#profile_menu_item = new PopupMenuProfile();
        this.#bindings.push(
            this.bind_property(
                'profile',
                this.#profile_menu_item,
                'profile',
                GObject.BindingFlags.SYNC_CREATE
            )
        );
        this.#bindings.push(
            this.bind_property(
                'profiles',
                this.#profile_menu_item,
                'profiles',
                GObject.BindingFlags.SYNC_CREATE
            )
        );
        this.#profile_activate_id = this.#profile_menu_item.connect(
            'profile-activate',
            (
                _element: PopupMenuProfile,
                menu_item: PopupMenu.PopupMenuItem
            ) => {
                this.profile = menu_item.label.get_text();
            }
        );
        this.menu.addMenuItem(this.#profile_menu_item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // this section is for controls
        this.#preview_menu_item = new PreviewMenuItem();
        this.#bindings.push(
            this.bind_property(
                'preview',
                this.#preview_menu_item,
                'preview',
                GObject.BindingFlags.SYNC_CREATE
            )
        );
        this.menu.addMenuItem(this.#preview_menu_item);
        this.#open_current_menu_item = new OpenCurrentMenuItem();
        this.menu.addMenuItem(this.#open_current_menu_item);
        this.#controls_menu_item = new ControlsMenuItem();
        this.#bindings.push(
            this.bind_property(
                'random',
                this.#controls_menu_item,
                'random',
                GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL
            )
        );
        this.#bindings.push(
            this.bind_property(
                'service-running',
                this.#controls_menu_item,
                'service_running',
                GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL
            )
        );
        this.#next_clicked_id = this.#controls_menu_item.connect(
            'next-clicked',
            () => this.emit('next-clicked')
        );
        this.#previous_clicked_id = this.#controls_menu_item.connect(
            'previous-clicked',
            () => this.emit('previous-clicked')
        );
        this.menu.addMenuItem(this.#controls_menu_item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // preferences
        this.#preferences_menu_item = new PopupMenu.PopupMenuItem(
            _('Preferences')
        );
        this.#preferences_activate_id = this.#preferences_menu_item.connect(
            'activate',
            () => this.emit('open-prefs')
        );
        this.menu.addMenuItem(this.#preferences_menu_item);
        // fin.
    }

    destroy() {
        for (const binding of this.#bindings) {
            binding.unbind();
        }

        this.#bindings = [];

        if (this.#profile_activate_id) {
            this.#profile_menu_item!.disconnect(this.#profile_activate_id);
            this.#profile_activate_id = undefined;
        }

        if (this.#preferences_activate_id) {
            this.#preferences_menu_item!.disconnect(
                this.#preferences_activate_id
            );
            this.#preferences_activate_id = undefined;
        }

        if (this.#next_clicked_id) {
            this.#controls_menu_item!.disconnect(this.#next_clicked_id);
            this.#next_clicked_id = undefined;
        }

        if (this.#previous_clicked_id) {
            this.#controls_menu_item!.disconnect(this.#previous_clicked_id);
            this.#previous_clicked_id = undefined;
        }

        this.#open_current_menu_item?.destroy();
        this.#open_current_menu_item = undefined;
        this.#preferences_menu_item?.destroy();
        this.#preferences_menu_item = undefined;
        this.#controls_menu_item?.destroy();
        this.#controls_menu_item = undefined;
        this.#preview_menu_item?.destroy();
        this.#preview_menu_item = undefined;
        this.#profile_menu_item?.destroy();
        this.#profile_menu_item = undefined;
        this.menu.removeAll();
        this.#icon?.destroy();
        this.#icon = undefined;
        super.destroy();
    }
}
