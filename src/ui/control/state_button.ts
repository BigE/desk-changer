import ControlButton from "./button.js";
import GObject from "gi://GObject";

export type StateType = {
    name: string;
    icon: string;
}

export default class ControlStateButton extends ControlButton {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiControlStateButton",
        }, this);
    }

    #clicked_id?: number;
    #state: number;
    #states: StateType[];

    constructor(states: StateType[]) {
        if (states.length < 2)
            throw new TypeError("There must be at least two states");

        super(states[0].icon);
        this.#state = 0;
        this.#states = states;
        this.#clicked_id = this.connect('clicked', () => {});
    }

    destroy() {
        if (this.#clicked_id) {
            this.disconnect(this.#clicked_id);
            this.#clicked_id = undefined;
        }

        super.destroy();
    }

    set_state(state: string) {
        if (this.#states[this.#state].name === state)
            return;

        for (let i = 0; i < this.#states.length; i++) {
            if (this.#states[i].name === state) {
                return this.set_icon(this.#states[i].icon);
            }
        }

        throw new TypeError(`State ${state} does not exist`);
    }
}
