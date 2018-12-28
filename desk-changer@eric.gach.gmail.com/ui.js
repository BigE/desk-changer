/**
 * Copyright (c) 2014-2018 Eric Gach <eric.gach@gmail.com>
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
const GObject = imports.gi.GObject;
const St = imports.gi.St;
const _ = Gettext.gettext;

const debug = Me.imports.utils.debug;
const error = Me.imports.utils.error;

var DeskChangerButton = GObject.registerClass(
class DeskChangerButton extends St.Button {
    _init(icon, callback) {
        this.icon = new St.Icon({icon_name: icon + '-symbolic', icon_size: 20});
        super._init({
            child: this.icon,
            style_class: 'system-menu-action'// : 'notification-icon-button control-button'
        });
        this._handler = this.connect('clicked', callback);
    }

    destroy() {
        debug('removing button clicked handler %s'.format(this._handler));
        this.disconnect(this._handler);
        this.icon.destroy();
        super.destroy();
    }

    set_icon(icon) {
        this.icon.icon_name = icon + '-symbolic';
    }
}
);

var DeskChangerIcon = GObject.registerClass(
class DeskChangerIcon extends St.Bin {
    _init(daemon, settings) {
        super._init({style_class: 'panel-status-menu-box'});
        this._gicon = Gio.icon_new_for_string(Me.path + '/icons/wallpaper-icon.png');
        this._daemon = daemon;
        this._settings = settings;
        // fallback when the daemon is not running
        this._icon = null;
        // the preview can be shown as the icon instead
        this._preview = null;
        // this will switch between the icon and preview when the setting is changed
        this._settings.connect('changed::icon-preview', this.update_child.bind(this));
        this._preview_id = this._daemon.connect('preview', this.update_child.bind(this));
        debug('connected preview handler %s'.format(this._preview_id));
        this.update_child();
    }

    destroy() {
        if (this._icon) {
            this._icon.destroy();
        }

        if (this._preview) {
            this._preview.destroy();
        }

        if (this._preview_id) {
            debug('disconnecting preview handler %s'.format(this._preview_id));
            this._daemon.disconnect(this._preview_id);
        }

        super.destroy();
    }

    update_child(file) {
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
    }

    _createPreview(file) {
        if (this._preview) {
            this._preview.destroy();
            this._preview = null;
        }

        this._preview = new DeskChangerPreview(34, this.daemon, this.update_child.bind(this));

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

var DeskChangerPreview = GObject.registerClass(
class DeskChangerPreview extends St.Bin {
    _init(width, daemon, callback) {
        super._init({
            x_align: St.Align.MIDDLE
        });
        this._file = null;
        this._callback = callback;
        this.daemon = daemon;
        this._texture = null;
        this._width = width;
        this._next_file_id = this.daemon.connect('preview', (function (obj, file) {
            this.set_wallpaper(file);
        }).bind(this));
        this._daemon_running_id = this.daemon.connect('running', (function (obj, running) {
            if (!running && this._texture) {
                this._texture.destroy();
                this._texture = null;
            }
        }).bind(this));

        if (this.daemon.desktop_profile.preview) {
            this.set_wallpaper(this.daemon.desktop_profile.preview);
        }

        this.set_child(this._texture);
    }

    destroy() {
        this.daemon.disconnect(this._next_file_id);
        this.daemon.disconnect(this._daemon_running_id);

        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }

        super.destroy();
    }

    set_wallpaper(file, c) {
        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }

        this._file = file = GLib.uri_unescape_string(file, null);
        file = file.replace('file://', '');
        debug('setting preview to %s'.format(file));
        try{
            let scale_factor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file, this._width * scale_factor, -1, true);
            let height = Math.round(pixbuf.get_height() / (pixbuf.get_width() / this._width));
            let image = new Clutter.Image();
            image.set_data(
                pixbuf.get_pixels(),
                (pixbuf.get_has_alpha()? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888),
                this._width * scale_factor,
                height * scale_factor,
                pixbuf.get_rowstride()
            );
            this._texture = new Clutter.Actor({height: height * scale_factor, width: this._width * scale_factor});
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
    }

    get file() {
        return this._file;
    }
}
);

var DeskChangerStateButton = GObject.registerClass(
class DeskChangerStateButton extends DeskChangerButton {
    _init(states, callback) {
        if (states.length < 2) {
            RangeError('You must provide at least two states for the button');
        }

        this._callback = callback;
        this._states = states;
        this._state = 0;
        super._init(this._states[0].icon, this._clicked.bind(this));
    }

    set_state(state) {
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
    }

    _clicked() {
        let state = this._state;
        if (++state >= this._states.length)
            state = 0;
        state = this._states[state].name;
        this.set_state(state);
        this._callback(state);
    }
}
);
