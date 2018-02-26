/**
 * Copyright (c) 2014-2017 Eric Gach <eric.gach@gmail.com>
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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Gettext = imports.gettext.domain(Me.metadata.uuid);
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Lang = imports.lang;
const St = imports.gi.St;
const _ = Gettext.gettext;

const debug = Me.imports.utils.debug;
const error = Me.imports.utils.error;

const DeskChangerButton = new Lang.Class({
    Name: 'DeskChangerButton',
    Extends: St.Button,

    _init: function (icon, callback) {
        this.icon = new St.Icon({icon_name: icon + '-symbolic', icon_size: 20});
        this.parent({
            child: this.icon,
            style_class: 'system-menu-action'// : 'notification-icon-button control-button'
        });
        this._handler = this.connect('clicked', callback);
    },

    destroy: function () {
        debug('removing button clicked handler %s'.format(this._handler));
        this.disconnect(this._handler);
        this.icon.destroy();
        this.parent();
    },

    set_icon: function (icon) {
        this.icon.icon_name = icon + '-symbolic';
    }
});

const DeskChangerIcon = new Lang.Class({
    Name: 'DeskChangerIcon',
    Extends: St.Bin,

    _init: function (daemon, settings) {
        this._gicon = Gio.icon_new_for_string(Me.path + '/icons/wallpaper-icon.png');
        this.daemon = daemon;
        this._settings = settings;
        this.parent({style_class: 'panel-status-menu-box'});
        // fallback when the daemon is not running
        this._icon = null;
        // the preview can be shown as the icon instead
        this._preview = null;
        // this will switch between the icon and preview when the setting is changed
        this._settings.connect('changed::icon-preview', Lang.bind(this, this.update_child));
        this.daemon.connectSignal('preview', Lang.bind(this, function (proxy, e, properties) {
            let file = properties[0];
            if (this._icon) {
                this.update_child(file);
            }
        }));
        this.update_child();
    },

    destroy: function () {
        if (this._icon) {
            this._icon.destroy();
        }

        if (this._preview) {
            this._preview.destroy();
        }

        this.parent();
    },

    update_child: function (file) {
        if (this._settings.icon_preview && this._createPreview(file)) {
            debug('updating icon to preview');
            this.set_child(this._preview);

            if (this._icon) {
                this._icon.destroy();
                this._icon = null;
            }
        } else if (!(this._icon)) {
            this._icon = new St.Icon({gicon: this._gicon, style_class: 'system-status-icon'});
            this.set_child(this._icon);

            if (this._preview) {
                this._preview.destroy();
                this._preview = null;
            }
        }
    },

    _createPreview: function (file) {
        if (this._preview) {
            this._preview.destroy();
            this._preview = null;
        }

        this._preview = new DeskChangerPreview(34, this.daemon, Lang.bind(this, this.update_child));

        if (!(this._preview.file)) {
            if (typeof file === "string") {
                this._preview.set_wallpaper(file);
            } else {
                this._preview.destroy();
                this._preview = null;
                return false;
            }
        }

        return true;
    }
});

const DeskChangerPreview = new Lang.Class({
    Name: 'DeskChangerPreview',
    Extends: St.Bin,

    _init: function (height, daemon, callback) {
        this.parent({
            x_align: St.Align.MIDDLE
        });
        this._file = null;
        this._callback = callback;
        this.daemon = daemon;
        this._texture = null;
        this._height = height;
        this._next_file_id = this.daemon.connectSignal('preview', Lang.bind(this, function (proxy, signalName, parameters) {
            let file = parameters[0];
            this.set_wallpaper(file);
        }));
        this._toggled_id = this.daemon.connect('toggled', Lang.bind(this, function () {
            if (!this.daemon.is_running && this._texture) {
                debug('clearing preview, daemon stopped');
                this._texture.destroy();
                this._texture = null;
            }
        }));

        if (this.daemon.bus.queue && this.daemon.bus.queue.length > 0) {
            this.set_wallpaper(this.daemon.bus.queue[0], false);
        }

        this.set_child(this._texture);
    },

    destroy: function () {
        this.daemon.disconnectSignal(this._next_file_id);
        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }
    },

    set_wallpaper: function (file, c) {
        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }

        this._file = file = GLib.uri_unescape_string(file, null);
        file = file.replace('file://', '');
        debug('setting preview to %s'.format(file));
        try{
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file, -1, this._height, true);
			let width = Math.round(pixbuf.get_width() / (pixbuf.get_height() / this._height));
            let image = new Clutter.Image();
            image.set_data(
                pixbuf.get_pixels(),
                (pixbuf.get_has_alpha()? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888),
                width,
                this._height,
                pixbuf.get_rowstride()
            );
            this._texture = new Clutter.Actor({height: this._height, width: width});
            this._texture.set_content(image);
            this.add_actor(this._texture);
        } catch (e) {
            error(e, 'Failed to set preview of %s'.format(file));
            if (this._texture) {
                this._texture.destroy();
                this._texture = null;
            }
            if (file.substr(-4) !== '.xml') {
                return;
            }
        }

        if (c === true && typeof this._callback === 'function') {
            this._callback(file);
        }
    },

    get file() {
        return this._file;
    }
});

const DeskChangerStateButton = new Lang.Class({
    Name: 'DeskChangerStateButton',
    Extends: DeskChangerButton,

    _init: function (states, callback) {
        if (states.length < 2) {
            RangeError('You must provide at least two states for the button');
        }

        this._callback = callback;
        this._states = states;
        this._state = 0;
        this.parent(this._states[0].icon, Lang.bind(this, this._clicked));
    },

    set_state: function (state) {
        if (state === this._states[this._state].name) {
            // We are already on that state... dafuq?!
            return;
        }

        for (let i = 0; i < this._states.length; i++) {
            if (this._states[i].name === state) {
                this.set_icon(this._states[i].icon);
                this._state = i;
                break;
            }
        }
    },

    _clicked: function () {
        let state = this._state;
        if (++state >= this._states.length)
            state = 0;
        state = this._states[state].name;
        this.set_state(state);
        this._callback(state);
    }
});
