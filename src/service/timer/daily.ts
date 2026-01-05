import GObject from 'gi://GObject';

import ServiceTimerHourly from './hourly.js';

/**
 * Daily service timer
 *
 * This timer will activate the internal callback when a new day starts. It
 * uses `ServiceTimerHourly` to do the top of the hour check and adds it's own
 * check for the hour itself.
 */
export default class ServiceTimerDaily extends ServiceTimerHourly {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerServiceTimerDaily',
            },
            this
        );
    }

    /**
     * Check if the timer is at the beginning of a new day
     *
     * Like `ServiceTimerHourly` this method creates a `new Date()` object to
     * compare the hour against. If the hour is "0" (midnight) then the date
     * is passed to the internal callback up the chain.
     *
     * @returns Returns true to keep the timeout running
     */
    protected __callback__(): boolean {
        const now = new Date();

        if (now.getHours() === 0) return super.__callback__(now);
        return true;
    }
}
