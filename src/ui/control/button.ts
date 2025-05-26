import St from "gi://St";
import GObject from "gi://GObject";

export default class ControlButton extends St.Button {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiControlButton",
        }, this);
    }

    #icon?: St.Icon;

    constructor(icon: string) {
        super({style_class: 'button'});
        this.#icon = new St.Icon({icon_name: `${icon}-symbolic`, icon_size: 20});
        this.add_child(this.#icon);
    }

    destroy() {
        this.#icon?.destroy();
        this.#icon = undefined;
        super.destroy();
    }

    set_icon(icon: string) {
        this.#icon?.destroy();
        this.#icon = new St.Icon({icon_name: icon});
        this.add_child(this.#icon);
    }
}
