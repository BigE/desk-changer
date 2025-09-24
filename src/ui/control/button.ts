import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * Button control that has an icon for the child
 *
 * This is used for a button control in the menu itself. The St.Button object
 * provides a clicked signal that can be attached to for when the button is
 * clicked by the user.
 */
export default class ControlButton extends St.Button {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiControlButton',
            },
            this
        );
    }

    constructor({icon_name, ...props}: Partial<St.Button.ConstructorProps>) {
        if (icon_name === undefined || icon_name === '')
            throw new TypeError('`icon_name` must be a string');

        props.style_class ??= 'icon-button';
        super(props);
        this.set_icon_name(icon_name);
    }

    set_icon_name(icon_name: string) {
        super.set_icon_name(`${icon_name}-symbolic`);
    }
}
