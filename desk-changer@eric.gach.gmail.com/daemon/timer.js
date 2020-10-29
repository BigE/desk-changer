'use strict';

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Signals = imports.signals;

var Interval = GObject.registerClass({
    Properties: {
        interval: GObject.ParamSpec.uint('interval', 'Interval', 'The interval that the callback is called.',
            GObject.ParamFlags.READABLE, 0, GLib.MAXUINT32, 300),
    },
},
class DeskChangerTimerInterval extends GObject.Object {
    _init(interval = 300, callback = null, params = {}) {
        if (callback && typeof callback !== 'function') {
            throw 'callback must be function';
        }

        this._callback = callback;
        this._interval = parseInt(interval);
        super._init(params);
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._interval, this.__callback__.bind(this));
        deskchanger.debug(`added timer ${this._timer}`);
    }

    get callback() {
        return this._callback;
    }

    get interval() {
        return this._interval;
    }

    __callback__() {
        if (this._callback) {
            deskchanger.debug('calling interval callback');
            return Boolean(this._callback());
        }

        return true;
    }

    destroy() {
        deskchanger.debug(`removing timer ${this._timer}`);
        GLib.source_remove(this._timer);
    }
});

var Hourly = GObject.registerClass(
class DeskChangerTimerHourly extends Interval {
    _init(callback, params = {}) {
        this._done = false;
        super._init(5, callback, params);
    }

    __callback__() {
        let date = new Date();

        if (date.getMinutes() === 0 && date.getSeconds() < 10) {
            if (!this._done) {
                this._done = true;
                deskchanger.debug('calling hourly callback');
                return super.__callback__();
            }

            return true;
        }

        this._done = false;
        return true;
    }
});
