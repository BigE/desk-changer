import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";

import {APP_PATH} from "../../common/interface.js";

export default class PanelMenuIcon extends St.Bin {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPanelMenuIcon",
        }, this);
    }

    #g_icon?: Gio.Icon;
    #icon?: St.Icon;
    #preview_id?: number;
    #settings?: Gio.Settings;

    constructor(settings: Gio.Settings) {
        super({style_class: "panel-status-menu-box"});
        this.#settings = settings;
        this.#g_icon = Gio.Icon.new_for_string(`resource://${APP_PATH}/icons/wallpaper-icon.svg`);
        this.update_child();
        this.#preview_id = this.#settings.connect('changed::icon-preview', () => this.update_child());
    }

    destroy() {
        if (this.#preview_id && this.#settings) {
            this.#settings.disconnect(this.#preview_id);
            this.#preview_id = undefined;
        }
        this._destroy_icon();
        this.#g_icon = undefined;
        this.#settings = undefined;
        super.destroy();
    }

    update_child() {
        this.#icon = new St.Icon({
            gicon: this.#g_icon,
            style_class: "system-status-icon",
        });
        this.set_child(this.#icon);
    }

    _destroy_icon() {
        this.#icon?.destroy();
        this.#icon = undefined;
    }
}
