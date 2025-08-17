import ControlButton from './button.js';
import GObject from 'gi://GObject';

export type StateType = {[state: string]: string};

/**
 * State button control that provides switching between states
 *
 * The state property controls the state of the control. Setting this or using
 * the set_state helper function will result in the icon being changed. When
 * the button is clicked, the state property will be automatically updated to
 * the state name that it was switched to.
 */
export default class ControlStateButton extends ControlButton {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiControlStateButton',
                Properties: {
                    state: GObject.param_spec_string(
                        'state',
                        'State',
                        'State name',
                        null,
                        GObject.ParamFlags.READWRITE
                    ),
                },
            },
            this
        );
    }

    #clicked_id?: number;
    #state?: string;
    readonly #states: StateType;

    get state() {
        return this.#state || null;
    }

    set state(state: string | null) {
        if (state) this.set_state(state);
        this.#state = state || undefined;
        this.notify('state');
    }

    constructor(states: StateType, state: string) {
        if (Object.entries(states).length < 2)
            throw new TypeError('There must be at least two states');

        super(states[state]);
        this.#state = state;
        this.#states = states;
        this.#clicked_id = this.connect('clicked', () => {
            const keys = Object.keys(this.#states);

            if (!this.#state) return (this.state = keys[0]);

            let currentIndex = keys.indexOf(this.#state);
            if (currentIndex === -1 || ++currentIndex >= keys.length)
                return (this.state = keys[0]);

            this.state = keys[currentIndex];
        });
    }

    destroy() {
        if (this.#clicked_id) {
            this.disconnect(this.#clicked_id);
            this.#clicked_id = undefined;
        }

        super.destroy();
    }

    set_state(state: string) {
        if (this.#state === state) return;

        if (!(state in this.#states))
            throw new TypeError(`State ${state} does not exist`);

        this.set_icon(this.#states[state]);
    }
}
