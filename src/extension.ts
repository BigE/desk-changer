import {Extension} from "resource:///org/gnome/shell/extensions/extension.js";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import {APP_ID} from "./common/interface.js";
import Service from "./service/index.js";
import PanelMenuButton from "./ui/panelMenu/button.js";

export default class DeskChangerExtension extends Extension {
    #button?: PanelMenuButton;
    #logger?: Console;
    #resource?: Gio.Resource;
    #service?: Service;
    #session_changed_id?: number;
    #settings?: Gio.Settings;

    enable() {
        if (!this.#resource) {
            this.#resource = Gio.Resource.load(`${this.path}/${APP_ID}.gresource`);
            Gio.resources_register(this.#resource);
        }

        if (!this.#logger)
            this.#logger = (this.getLogger() as unknown) as Console;

        if (!this.#settings)
            this.#settings = this.getSettings();

        if (!this.#service)
            this.#service = new Service(this.#settings, this.#logger);

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

        this.#removeIndicator();

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

    #addIndicator() {
        if (!this.#settings)
            throw new TypeError("Settings object is required");

        if (!this.#service)
            throw new TypeError("Service object is required");

        this.#button = new PanelMenuButton(this.uuid, this.#settings, this.#service, this.openPreferences.bind(this));
        Main.panel.addToStatusArea(this.uuid, this.#button);
    }

    #is_session_mode_user(session: any): boolean {
        return ('currentMode' in session && session.currentMode === 'user') || ('parentMode' in session && session.parentMode === 'user');
    }

    #onSessionModeChanged(session: any) {
        if (this.#is_session_mode_user(session))
            this.#addIndicator();
        else if ('currentMode' in session && session.currentMode === 'unlock-dialog')
            this.#removeIndicator();
    }

    #removeIndicator() {
        this.#button?.destroy();
        this.#button = undefined;
    }
}
