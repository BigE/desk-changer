import St from "gi://St";
import GObject from "gi://GObject";

/**
 * Button control that has an icon for the child
 *
 * This is used for a button control in the menu itself. The St.Button object
 * provides a clicked signal that can be attached to for when the button is
 * clicked by the user.
 */
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

    /**
     * Set the icon
     * @param icon
     */
    set_icon(icon: string) {
        if (!this.#icon)
            return;

        this.#icon.set_icon_name(`${icon}-symbolic`);
    }
}
