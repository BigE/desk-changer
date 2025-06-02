import GObject from "gi://GObject";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import ControlButton from "../control/button.js";
import ControlStateButton from "../control/state_button.js";

export namespace ControlsMenuItem {
    export interface ConstructorProps extends PopupMenu.PopupBaseMenuItem.ConstructorProps {
        random: boolean;
    }
}

/**
 * Control menu item to give control over the service
 *
 * This menu item will provide controls for next, previous, and random that can
 * be used to interact with the service and settings. When the random property
 * is changed the icon will update accordingly and when the random control is
 * clicked, the property will be updated. The next and previous controls both
 * emit their respective next-clicked and previous-clicked signals when the
 * control is clicked.
 */
export default class ControlsMenuItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPopupMenuControlsMenuItem",
            Properties: {
                "random": GObject.param_spec_boolean(
                    "random", "Random",
                    "Tell the daemon to randomly select the next wallpaper",
                    false, GObject.ParamFlags.READWRITE
                )
            },
            Signals: {
                "next-clicked": [],
                "previous-clicked": [],
            },
        }, this);
    }

    #next?: ControlButton;
    #next_clicked_id?: number;
    #prev?: ControlButton;
    #prev_clicked_id?: number;
    #random: boolean;
    #random_control?: ControlStateButton;
    #random_clicked_id?: number;

    get random() {
        return this.#random;
    }

    set random(value: boolean) {
        this.#random = value;
        this.#random_control?.set_state(value? 'random' : 'ordered');
        this.notify("random");
    }

    constructor(properties?: Partial<ControlsMenuItem.ConstructorProps>) {
        const { random, ...props } = properties || {};
        super(props);

        this.#random = random || true;
        this.#next = new ControlButton('media-skip-forward');
        this.#next_clicked_id = this.#next.connect('clicked', () => this.emit("next-clicked"));
        this.#prev = new ControlButton('media-skip-backward');
        this.#prev_clicked_id = this.#prev.connect('clicked', () => this.emit("previous-clicked"));
        this.#random_control = new ControlStateButton({
            random: 'media-playlist-shuffle',
            ordered: 'media-playlist-repeat',
        }, this.#random? 'random' : 'ordered');
        this.#random_clicked_id = this.#random_control.connect('notify::state', () => {
            this.random = (this.#random_control?.state === "random");
        });

        this.add_child(this.#prev);
        this.add_child(this.#random_control);
        this.add_child(this.#next);
    }

    destroy() {
        if (this.#next_clicked_id) {
            this.#next!.disconnect(this.#next_clicked_id);
            this.#next_clicked_id = undefined;
        }

        if (this.#prev_clicked_id) {
            this.#prev!.disconnect(this.#prev_clicked_id);
            this.#prev_clicked_id = undefined;
        }

        if (this.#random_clicked_id) {
            this.#random_control!.disconnect(this.#random_clicked_id);
            this.#random_clicked_id = undefined;
        }

        this.#next?.destroy();
        this.#next = undefined;
        this.#prev?.destroy()
        this.#prev = undefined;
        this.#random_control?.destroy();
        this.#random_control = undefined;
        super.destroy();
    }
}
