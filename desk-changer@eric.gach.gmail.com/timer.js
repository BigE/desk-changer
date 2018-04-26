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
