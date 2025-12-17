import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import ServiceTimer, { ServiceCallback } from './index.js';

export default class ServiceTimerInterval extends ServiceTimer {
    readonly #interval: number;
    #timer_id?: number;

    static {
        GObject.registerClass({
            GTypeName: 'DeskChangerServiceTimerInterval',
            Properties: {
                'interval': GObject.param_spec_int(
                    'interval',
                    'Interval',
                    'Timer interval that the callback executes',
                    1,
                    86400,
                    300,
                    GObject.ParamFlags.READABLE
                ),
            },
        }, this);
    }

    get interval() {
        return this.#interval;
    }

    /**
     * Interval timer
     * 
     * @param interval Timer interval in seconds
     * @param callback Callback to call for the interval timeout
     */
    constructor(interval: number, callback?: ServiceCallback) {
        super(callback);

        if (interval < 1 || interval > 86400)
            throw new Error(_('Interval must be between 1 and 86400'));

        this.#interval = interval;
        this.#timer_id = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.#interval,
            this.__callback__.bind(this)
        );
    }

    destroy() {
        if (this.#timer_id) {
            GLib.source_remove(this.#timer_id);
            this.#timer_id = undefined;
        }
    }
}
