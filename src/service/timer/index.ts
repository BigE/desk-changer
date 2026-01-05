import GObject from 'gi://GObject';

export type ServiceCallback = () => boolean;

namespace ServiceTimer {
    export interface ConstructorProps {
        callback: ServiceCallback;
    }
}

/**
 * Base timer object that all timers extend from
 *
 * This class should be considered abstract and all timers should inherit this
 * class for full support. The callback for the timer being run is defined and
 * called through this class.
 *
 * @see __callback__
 */
class ServiceTimer extends GObject.Object {
    readonly #callback?: ServiceCallback;

    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerServiceTimer',
                Signals: {
                    activated: {},
                },
            },
            this
        );
    }

    /**
     * Create a new timer object
     *
     * @param callback Optional function to run when the timer is activated
     */
    constructor({callback}: Partial<ServiceTimer.ConstructorProps>) {
        super();

        if (this.constructor === ServiceTimer)
            throw new TypeError(
                `Cannot instantiate abstract class ${this.constructor.name}`
            );

        this.#callback = callback;
    }

    /**
     * Destroy the timer object
     *
     * The destroy method is always called by the service runner for clean up
     * when destroying the timer. This class does not have anything to clean up
     * but provides the method for compatibility. There is no need to call
     * `super.destroy()` when implementing your own.
     */
    destroy(): void {}

    /**
     * Run the callback method and emit the activated signal
     *
     * This method will automatically run the callback if it was provided in
     * the constructor. It will also emit the activated signal allowing
     * multiple ways to trigger a callback to run. This should only be called
     * when the timer is activated.
     *
     * @returns Return value should be true if the timer should continue
     */
    protected __callback__() {
        if (this.#callback) {
            return this.#callback();
        }

        this.emit('activated');
        return true;
    }
}

export default ServiceTimer;
