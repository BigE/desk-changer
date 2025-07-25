import GObject from "gi://GObject";

import ServiceTimer, {ServiceCallback} from "./index.js";

export default class ServiceTimerHourly extends ServiceTimer {
    #done: boolean;

    static {
        GObject.registerClass({
            GTypeName: "DeskChangerServiceTimerHourly",
        }, this);
    }

    constructor(callback: ServiceCallback) {
        super(5, callback);

        this.#done = false;
    }

    protected __callback__(): boolean {
        const date = new Date();

        if (date.getMinutes() === 0 && date.getSeconds() < 10 && !this.#done) {
            this.#done = true;
            return super.__callback__();
        }

        this.#done = false;
        return true;
    }
}
