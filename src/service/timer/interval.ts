import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import ServiceTimer from './index.js';

namespace ServiceTimerInterval {
    export interface ConstructorProps extends ServiceTimer.ConstructorProps {
        interval: number;
    }
}

/**
 * Interval timer that runs a timeout based on seconds
 *
 * This timer uses `GLib.timeout_add_seconds` internally to create a timer that
 * runs at the specified interval. This is NOT exact as it is up to the GLib
 * system to call our timeout callback when it is able to. The range of the
 * interval timer is 1 to 86400 seconds, or a 24 hour period.
 */
class ServiceTimerInterval extends ServiceTimer {
    readonly #interval: number;
    #timer_id?: number;

    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerServiceTimerInterval',
                Properties: {
                    interval: GObject.param_spec_int(
                        'interval',
                        'Interval',
                        'Timer interval that the callback executes',
                        1,
                        86400,
                        300,
                        GObject.ParamFlags.READABLE
                    ),
                },
            },
            this
        );
    }

    get interval() {
        return this.#interval;
    }

    /**
     * Create a new interval timer instance
     *
     * When a new interval timer is created we register the internal callback
     * through `GLib.timeout_add_seconds`. Once it runs the `ServiceTimer`
     * internal callback will be triggered, which should trigger the
     * `activated` signal and any callback passed to the constructor.
     */
    constructor({
        interval,
        ...props
    }: Partial<ServiceTimerInterval.ConstructorProps>) {
        super(props);

        if (!interval || interval < 1 || interval > 86400)
            throw new Error(_('Interval must be between 1 and 86400'));

        this.#interval = interval;
        this.#timer_id = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this.#interval,
            this.__callback__.bind(this)
        );
    }

    /**
     * Cleanup the interval timer
     *
     * Ensure that the timer is properly cleaned up by destroying the timer
     * through `GLib.source_remove`
     */
    destroy() {
        if (this.#timer_id) {
            GLib.source_remove(this.#timer_id);
            this.#timer_id = undefined;
        }
    }
}

export default ServiceTimerInterval;
