import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import {APP_ID} from "./common/interface.js";
import Service from "./service/index.js";
import PanelMenuButton from "./ui/panelMenu/button.js";
import RotationModes from "./common/rotation_modes.js";
import {SettingsRotationModes} from "./common/settings.js";

/**
 * DeskChanger - A simple wallpaper changer
 *
 * The base extension manages the service and the button. The service can stay
 * running while the button is added/removed every time the lockscreen is
 * shown. The extension manages the links and bindings between the button and
 * the settings object. The service manages the wallpaper changes and timers
 * that control the changes.
 */
export default class DeskChangerExtension extends Extension {
    #button?: PanelMenuButton;
    #logger?: Console;
    #next_clicked_id?: number;
    #open_prefs_id?: number;
    #previous_clicked_id?: number;
    #resource?: Gio.Resource;
    #source?: GLib.Source;
    #service?: Service;
    #service_notifications: number[] = [];
    #service_preview_binding?: GObject.Binding;
    #session_changed_id?: number;
    #settings?: Gio.Settings;
    #settings_notifications: number[] = [];

    constructor(metadata: any) {
        super(metadata);
        this.initTranslations(this.uuid);
    }

    /**
     * Enable the extension
     *
     * Since we're using unlock-dialog in the metadata, ensure we're creating
     * objects if they don't exist because this could be called multiple times
     * through the extensions lifetime.
     */
    enable() {
        if (!this.#resource) {
            this.#resource = Gio.Resource.load(`${this.path}/${APP_ID}.gresource`);
            Gio.resources_register(this.#resource);
        }

        if (!this.#logger) {
            if ('getLogger' in this && typeof this.getLogger === "function")
                this.#logger = (this.getLogger() as unknown) as Console;
            else
                this.#logger = (console as unknown) as Console;
        }

        if (!this.#settings)
            this.#settings = this.getSettings();

        if (!this.#service)
            this.#service = new Service({ logger: this.#logger, settings: this.#settings });

        if (!this.#service.is_dbus_name_owned())
            this.#service.own_name();

        if (this.#settings.get_boolean('auto-start') && !this.#service.Running)
            this.#service.Start();

        this.#onSessionModeChanged(Main.sessionMode);
        this.#session_changed_id = Main.sessionMode.connect('updated', this.#onSessionModeChanged.bind(this))

        if (this.#is_session_mode_user(Main.sessionMode))
            this.#logger.log('extension enabled');
    }

    /**
     * Disable extension and remove resources
     *
     * This extension uses unlock-dialog to enable the wallpaper change to
     * happen even while the lockscreen is being displayed. Only the service
     * remains running during the lockscreen, which also preserves the timer
     * that runs at specific intervals. The service is also available via the
     * session DBus connection.
     */
    disable() {
        if (this.#session_changed_id) {
            Main.sessionMode.disconnect(this.#session_changed_id);
            this.#session_changed_id = undefined;
        }

        // call this to clean up the indicator and notifications
        this.#sessionModeUnlockDialog();
        this.#source?.destroy();
        this.#source = undefined;

        if (this.#is_session_mode_user(Main.sessionMode)) {
            this.#service?.destroy();
            this.#service = undefined;
            this.#settings = undefined;
            if (this.#resource)
                Gio.resources_unregister(this.#resource);
            this.#resource = undefined;
            this.#logger?.log('extension disabled');
            this.#logger = undefined;
        }
    }

    /**
     * Add the indicator to the main panel
     *
     * This is where all the binding magic happens between the settings,
     * service and the button itself. This should be called every time the
     * screen is unlocked or the extension is enabled.
     *
     * @private
     */
    #addIndicator() {
        if (!this.#settings)
            throw new TypeError("Settings object is required");

        if (!this.#service)
            throw new TypeError("Service object is required");

        this.#button = new PanelMenuButton(this.uuid);
        // settings bindings
        this.#settings.bind('current-profile', this.#button, 'profile', Gio.SettingsBindFlags.DEFAULT);
        this.#settings.bind('icon-preview', this.#button, 'icon_preview_enabled', Gio.SettingsBindFlags.GET);
        this.#settings.bind('random', this.#button, 'random', Gio.SettingsBindFlags.DEFAULT);
        this.#settings.bind_with_mapping('profiles', this.#button, 'profiles', Gio.SettingsBindFlags.GET, (value, variant) => {
            // according to the g_settings_bind_with_mapping the value is
            // supposed to be an assignable reference here and then that gets
            // set to the object property. however, there is no way to set the
            // value here since it is passed in as null and that isn't a
            // reference in JS. this is a dirty nasty hack.
            this.#source = setTimeout(() => {
                if (this.#button && this.#settings)
                    this.#button.profiles = this.#settings.get_value("profiles");
                this.#source?.destroy();
                this.#source = undefined;
            }, 50);

            // this is what the C implementation expects?? but value is `null`
            value = variant;
            return true;
        }, null);
        // service bindings
        this.#service_preview_binding = this.#service.bind_property('Preview', this.#button, 'preview', GObject.BindingFlags.SYNC_CREATE);
        // signals
        this.#next_clicked_id = this.#button.connect('next-clicked', () => { this.#service?.Next() });
        this.#open_prefs_id = this.#button.connect('open-prefs', this.openPreferences.bind(this));
        this.#previous_clicked_id = this.#button.connect('previous-clicked', () => { this.#service?.Previous() });
        Main.panel.addToStatusArea(this.uuid, this.#button);
    }

    #bindNotifications() {
        if (this.#service) {
            this.#service_notifications.push(this.#service.connect(
                'Changed',
                (_sender: any, uri: string) =>
                    this.#sendNotification(this.gettext("Wallpaper changed: %s").format(uri)))
            );
        }

        if (this.#settings) {
            this.#settings_notifications.push(this.#settings.connect(
                'changed::current-profile',
                (settings: Gio.Settings) => this.#sendNotification(
                    _("Profile changed to %s").format(settings.get_string("current-profile"))
                )
            ));

            this.#settings_notifications.push(this.#settings.connect("changed::notifications", (settings: Gio.Settings) => {
                this.#sendNotification(((settings.get_boolean("notifications")) ?
                        _("Notifications are now enabled") :
                        _("Notifications are now disabled")
                ), true);
            }));

            this.#settings_notifications.push(this.#settings.connect('changed::random', (settings: Gio.Settings) => {
                this.#sendNotification(((settings.get_boolean("random"))?
                        _("Wallpapers will be shown in a random order") :
                        _("Wallpapers will be shown in the order they were loaded")
                ));
            }));

            this.#settings_notifications.push(this.#settings.connect('changed::rotation', (settings: Gio.Settings) => {
                let message;
                const rotation = RotationModes[settings.get_string('rotation') as SettingsRotationModes];

                switch (rotation.timer) {
                    case 'interval':
                        message = _("Rotation will occur at a set interval of %d seconds".format(rotation.interval));
                        break;
                    case 'hourly':
                        message = _('Rotation will occur at the beginning of every hour');
                        break;
                    case 'daily':
                        message = _('Rotation will occur at the beginning of every day');
                        break;
                    default:
                        message = _('Rotation has been disabled');
                        break;
                }

                this.#sendNotification(message);
            }));
        }
    }

    /**
     * Helper to simplify check currentMode and parentMode for a user session
     *
     * @param session
     * @private
     */
    #is_session_mode_user(session: any): boolean {
        return ('currentMode' in session && session.currentMode === 'user') || ('parentMode' in session && session.parentMode === 'user');
    }

    /**
     * Simple handler for enabling/disabling the button
     *
     * @param session
     * @private
     */
    #onSessionModeChanged(session: any) {
        if (this.#is_session_mode_user(session))
            this.#sessionModeUser();
        else if ('currentMode' in session && session.currentMode === 'unlock-dialog')
            this.#sessionModeUnlockDialog();
    }

    /**
     * Remove the button from the main panel
     *
     * This cleans up all the bindings that addIndicator created and
     * empties the objects that were assigned. This should be called every
     * time the screen is locked or the extension is disabled.
     *
     * @private
     */
    #removeIndicator() {
        if (this.#service_preview_binding) {
            this.#service_preview_binding.unbind();
            this.#service_preview_binding = undefined;
        }

        if (this.#next_clicked_id) {
            this.#button!.disconnect(this.#next_clicked_id);
            this.#next_clicked_id = undefined;
        }

        if (this.#open_prefs_id) {
            this.#button!.disconnect(this.#open_prefs_id);
            this.#open_prefs_id = undefined;
        }

        if (this.#previous_clicked_id) {
            this.#button!.disconnect(this.#previous_clicked_id);
            this.#previous_clicked_id = undefined;
        }

        this.#button?.destroy();
        this.#button = undefined;
    }

    #sendNotification(message: string, force: boolean = false) {
        if (!this.#settings?.get_boolean('notifications') && !force)
            return;

        Main.notify(this.metadata.name, message);
    }

    #sessionModeUser() {
        this.#addIndicator();
        this.#bindNotifications();
    }

    #sessionModeUnlockDialog() {
        this.#removeIndicator();
        this.#unbindNotifications();
    }

    #unbindNotifications() {
        for (const notification_id of this.#service_notifications) {
            this.#service!.disconnect(notification_id);
        }

        this.#service_notifications = [];

        for (const notification_id of this.#settings_notifications) {
            this.#settings!.disconnect(notification_id);
        }

        this.#settings_notifications = [];
    }
}
