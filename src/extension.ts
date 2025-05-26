import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import PanelMenuButton from "./ui/panelMenu/button.js";
import {APP_ID} from "./common/interface.js";
import Service from "./service/index.js";

export default class DeskChangerExtension extends Extension {
    #button?: PanelMenuButton;
    #logger?: Console;
    #resource?: Gio.Resource;
    #service?: Service;
    #session_changed_id?: number;
    #settings?: Gio.Settings;

    enable() {
        this.#resource = Gio.Resource.load(`${this.path}/${APP_ID}.gresource`);
        Gio.resources_register(this.#resource);

        // @ts-expect-error
        this.#logger = this.getLogger();
        this.#settings = this.getSettings();
        this.#service = new Service(this.#settings, this.#logger!);
        if (this.#settings.get_boolean('auto-start'))
            this.#service.Start();

        this._onSessionModeChanged(Main.sessionMode);
        this.#session_changed_id = Main.sessionMode.connect('updated', this._onSessionModeChanged.bind(this))
    }

    disable() {
        if (this.#session_changed_id) {
            Main.sessionMode.disconnect(this.#session_changed_id);
            this.#session_changed_id = undefined;
        }

        this._removeIndicator();
        this.#service?.destroy();
        this.#service = undefined;
        this.#logger = undefined;
        this.#settings = undefined;
        if (this.#resource)
            Gio.resources_unregister(this.#resource);
        this.#resource = undefined;
    }

    _addIndicator() {
        this.#button = new PanelMenuButton(this.metadata.uuid, this.#settings!, this.#service!, this.#logger!, this.openPreferences.bind(this));
        Main.panel.addToStatusArea(this.metadata.uuid, this.#button);
    }

    _onSessionModeChanged(session: any) {
        if (session.currentMode === 'user' || session.parentMode === 'user')
            this._addIndicator();
        else if (session.currentMode === 'unlock-dialog')
            this._removeIndicator();
    }

    _removeIndicator() {
        this.#button?.destroy();
        this.#button = undefined;
    }
}
