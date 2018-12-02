/**
 * Copyright (c) 2018 Eric Gach <eric.gach@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;

const debug = Me.imports.utils.debug;

const DeskChangerTimer = new Lang.Class({
    Name: 'DeskChangerTimer',
    Abstract: true,

    _init: function (interval, callback) {
        if (typeof callback !== 'function') {
            throw 'timer callback must be callable';
        }

        this._callback = callback;
        this._source_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.interval, Lang.bind(this, this.__callback__));
        debug('created new timer for %s seconds'.format(this._settings.interval));
    },

    destroy: function () {
        if (this._source_id) {
            debug('destroying timer %s'.format(this._source_id));
            GLib.source_remove(this._source_id);
            this._source_id = null;
        }
    },

    __callback__: function () {
        return Boolean(this._callback());
    },
});

var DeskChangerTimerInterval = new Lang.Class({
    Name: 'DeskChangerTimerInterval',
    Extends: DeskChangerTimer,

    _init: function (settings, callback) {
        this._settings = settings;
        this.parent(this._settings.interval, callback);
        this._interval_handler_id = this._settings.connect('changed::interval', Lang.bind(this, function () {
            this.destroy();
            this._source_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.interval, Lang.bind(this, this.__callback__));
            debug('reset timer since interval changed');
        }));
    },

    destroy: function () {
        if (this._interval_handler_id) {
            this._settings.disconnect(this._interval_handler_id);
        }

        this.parent();
    }
});


var DeskChangerTimerHourly = new Lang.Class({
    Name: 'DeskChangerTimerHourly',
    Extends: DeskChangerTimer,

    _init: function (callback) {
        this._done = false;
        parent._init(5, callback);
    },

    __callback__: function () {
        let date = new Date();

        if (date.getMinutes() === 0 && date.getSeconds() < 10) {
            if (!this._done) {
                this._done = true;
                return parent.__callback__();
            }

            return true;
        }

        this._done = false;
        return true;
    },
});
