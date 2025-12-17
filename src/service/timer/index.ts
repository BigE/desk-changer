import GObject from 'gi://GObject';

export type ServiceCallback = () => boolean;

export default class ServiceTimer extends GObject.Object {
    readonly #callback?: ServiceCallback;

    static {
        GObject.registerClass({
            GTypeName: 'DeskChangerServiceTimer',
        }, this);
    }

    constructor(callback?: ServiceCallback) {
        super();

        this.#callback = callback;
    }

    destroy(): void {
    }

    protected __callback__() {
        if (this.#callback) {
            return this.#callback();
        }

        return true;
    }
}
