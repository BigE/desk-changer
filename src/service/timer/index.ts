import GLib from "gi://GLib";
import GObject from "gi://GObject";

export type ServiceCallback = () => boolean;

export default class ServiceTimer extends GObject.Object {
    readonly #callback?: ServiceCallback;
    readonly #interval: number;
    #timer_id?: number;

    static {
        GObject.registerClass({
            Properties: {
                "interval": GObject.param_spec_int(
                    "interval", "Interval",
                    "Timer interval that the callback executes",
                    1, 86400, 300, GObject.ParamFlags.READABLE
                ),
            }
        }, this);
    }

    get interval() {
        return this.#interval;
    }

    constructor(interval: number, callback?: ServiceCallback) {
        super();

        if (interval < 1 || interval > 86400)
            throw new Error("Interval must be between 1 and 86400");

        this.#callback = callback;
        this.#interval = interval;
        this.#timer_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.#interval, this.__callback__.bind(this));
    }

    destroy() {
        if (this.#timer_id) {
            GLib.source_remove(this.#timer_id);
            this.#timer_id = undefined;
        }
    }

    protected __callback__() {
        if (this.#callback) {
            return this.#callback();
        }

        return true;
    }
}
