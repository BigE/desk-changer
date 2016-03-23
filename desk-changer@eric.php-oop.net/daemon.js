/**
 * Copyright (c) 2014-2015 Eric Gach <eric@php-oop.net>
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
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const DeskChangerDaemon = new Lang.Class({
    Name: 'DeskChangerDaemon',

    _init: function () {
        this._pid = null;
        this._is_running = false;
        this._cancel = new Gio.Cancellable();
        this._path = Me.dir.get_path();
        this._daemon_pid = Gio.File.new_for_path(this._path + '/daemon.pid');
        if (this._daemon_pid.query_exists(null)) {
            this._on();
        }

        // add the file monitor to watch the daemon pid file
        this._file_monitor = this._daemon_pid.monitor_file(Gio.FileMonitorFlags.NONE, this._cancel);
        debug('added file monitor ' + this._file_monitor);
        this._file_monitor.connect('changed', Lang.bind(this, function (monitor, file, other_file, event_type) {
            debug('changed(' + monitor + ', ' + file + ', ' + other_file + ', ' + event_type + ')');
            if (event_type == Gio.FileMonitorEvent.DELETED) {
                this._off();
            } else if (event_type == Gio.FileMonitorEvent.CHANGED) {
                this._on();
            }
        }));
    },

    destroy: function () {
        if (this._file_monitor)
            this._file_monitor.cancel();
        if (this._child_watch)
            GLib.source_remove(this._child_watch);
    },

    toggle: function () {
        if (this._is_running) {
            debug('stopping daeomn');
            GLib.spawn_async(this._path, ['/usr/bin/python', this._path + '/daemon.py', 'stop'], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
        } else {
            debug('starting daemon');
            GLib.spawn_async(this._path, ['/usr/bin/python', this._path + '/daemon.py', 'start'], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
        }
    },

    _off: function () {
        this._is_running = false;
        this._pid = null;

        if (this._child_watch) {
            GLib.source_remove(this._child_watch);
            this._child_watch = null;
        }

        debug('emit(\'toggled\', false, null)');
        this.emit('toggled', false, null);
    },

    _on: function () {
        var [success, pid] = this._daemon_pid.load_contents(null);
        if (success) {
            debug('the desk-changer daemon is running with pid of ' + pid);
            this._pid = pid;
            this._is_running = true;
            this._watch(pid);
            debug('emit(\'toggled\', true, ' + pid + ')');
            this.emit('toggled', true, pid);
        }
    },

    _watch: function (pid) {
        if (!this._child_watch) {
            this._child_watch = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this._off), {});
            debug('added child watch on pid (' + pid + '): ' + this._child_watch);
        }
    },

    get is_running() {
        return this._is_running;
    }
});

Signals.addSignalMethods(DeskChangerDaemon.prototype);

function debug(output) {
    var date = new Date();
    output = '[' + date.toLocaleString() + ']' + Me.metadata.uuid + '[daemon]: ' + output;
    log(output);
}
