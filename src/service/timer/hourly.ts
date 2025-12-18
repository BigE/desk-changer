import GObject from 'gi://GObject';

import ServiceTimerInterval from './interval.js';

namespace ServiceTimerHourly {
    export type ConstructorProps = Omit<
        ServiceTimerInterval.ConstructorProps,
        'interval'
    >;
}

/**
 * Hourly service timer
 *
 * This timer will activate within 5 seconds of every hour. We use the
 * `ServiceTimerInterval` to run the internal callback every 5 seconds. This
 * allows it to check if we're within 10 seconds of the top of every hour. If
 * we are, the internal callback continues up the chain.
 */
class ServiceTimerHourly extends ServiceTimerInterval {
    #done: boolean;

    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerServiceTimerHourly',
            },
            this
        );
    }

    /**
     * Create a new hourly timer
     *
     * When this timer is created we simply pass an interval of 5 to the parent
     * and let the internal callback handle checking the time.
     */
    constructor({callback}: Partial<ServiceTimerHourly.ConstructorProps>) {
        super({callback: callback, interval: 5});

        this.#done = false;
    }

    /**
     * Check if the timer is at the top of the hour
     *
     * The internal callback should only be passed up the chain when we're
     * within 10 seconds of the top of the hour. We create a `new Date()`
     * object every time this callback is run to check against.
     *
     * @param date Optional date to prevent from creating another
     * @returns Returns true to keep the timeout running
     */
    protected __callback__(date: Date | undefined = undefined): boolean {
        const now = date || new Date();

        if (now.getMinutes() === 0 && now.getSeconds() < 10 && !this.#done) {
            this.#done = true;
            return super.__callback__();
        }

        this.#done = false;
        return true;
    }
}

export default ServiceTimerHourly;
