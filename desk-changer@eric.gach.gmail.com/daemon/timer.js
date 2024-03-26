'use strict';

import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { debug } from "../common/logging.js";

export const Interval = GObject.registerClass({
    Properties: {
        interval: GObject.ParamSpec.uint('interval', 'Interval',
            'The interval at which the callback is triggered',
            GObject.ParamFlags.READABLE, 1, GLib.MAXUINT32, 300),
    },
},
class DeskChangerTimerInterval extends GObject.Object {
    _init(interval, callback = null, params = {}) {
        if (callback && typeof callback !== 'function') {
            throw 'callback must be function';
        }

        if (!interval || interval < 1)  {
            throw 'invalid interval, must be 1 or higher';
        }

        this._callback = callback;
        this._interval = parseInt(interval);
        super._init(params);
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._interval, this.__callback__.bind(this));
        debug(`added interval(${this._interval}) timer ${this._timer}`);
    }

    get callback() {
        return this._callback;
    }

    get interval() {
        return this._interval;
    }

    __callback__() {
        if (this._callback) {
            debug('calling interval callback');
            return Boolean(this._callback());
        }

        return true;
    }

    destroy() {
        debug(`removing interval timer ${this._timer}`);
        GLib.source_remove(this._timer);
    }
});

export const Hourly = GObject.registerClass(
class DeskChangerTimerHourly extends Interval {
    _init(callback, params = {}) {
        this._done = false;
        super._init(5, callback, params);
    }

    _timer_check(date) {
        if (date.getMinutes() === 0 && date.getSeconds() < 10) {
            return true;
        }

        return false
    }

    __callback__() {
        if (this._timer_check(new Date())) {
            if (!this._done) {
                this._done = true;
                debug('calling hourly callback');
                return super.__callback__();
            }

            return true;
        }

        this._done = false;
        return true;
    }
});

export const Daily = GObject.registerClass(
class DeskChangerTimerDaily extends Hourly {
    _timer_check(date) {
        if (super._timer_check(date) && date.getHours() === 0) {
            return true;
        }

        return false;
    }
});
