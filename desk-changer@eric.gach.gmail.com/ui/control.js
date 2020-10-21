const Me = imports.misc.extensionUtils.getCurrentExtension();

const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const GLib = imports.gi.GLib;
const GdkPixbuf = imports.gi.GdkPixbuf;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

var ButtonControl = GObject.registerClass(
class DeskChangerControlButtonControl extends St.Button {
    _init(icon, callback) {
        this._icon = new St.Icon({icon_name: `${icon}-symbolic`, icon_size: 20});
        super._init({child: this._icon, style_class: 'button'});
        this._clicked_id = this.connect('clicked', callback);
        deskchanger.debug(`connect clicked (${this._clicked_id})`);
    }

    destroy() {
        if (this._clicked_id) {
            deskchanger.debug(`disconnect clicked (${this._clicked_id})`);
            this.disconnect(this._clicked_id);
        }
        this._clicked_id = null;

        this._icon.destroy();
        super.destroy();
    }

    set_icon(icon) {
        this._icon.icon_name = `${icon}-symbolic`;
    }
}
);

var PreviewControl = GObject.registerClass(
    class DeskChangerPreviewControl extends St.Bin {
        _init(width, daemon, callback) {
            super._init({ x_align: St.Align.MIDDLE });
            this._file = null;
            this._callback = callback;
            this._daemon = daemon;
            this._texture = null;
            this._width = width;
            this._next_file_id = this._daemon.connectSignal('Preview', (proxy, name, [uri]) => {
                deskchanger.debug(`DBUS::Preview(${uri})`);
                this.set_wallpaper(uri);
            });
            this._running_id = this._daemon.connectSignal('Running', (proxy, name, [running]) => {
                if (running === false && this._texture) {
                    deskchanger.debug('clearing preview, daemon stopped');
                    this._texture.destroy();
                    this._texture = null;
                }
            });

            if (daemon.Preview) {
                this.set_wallpaper(daemon.Preview);
            }

            this.set_child(this._texture);
        }

        destroy() {
            if (this._next_file_id) {
                this._daemon.disconnectSignal(this._next_file_id);
            }
            this._next_file_id = null;

            if (this._running_id) {
                this._daemon.disconnect(this._running_id);
            }
            this._running_id = null;

            if (this._texture) {
                this._texture.destroy();
            }
            this._texture = null;

            super.destroy();
        }

        set_wallpaper(file, c) {
            if (this._texture) {
                this._texture.destroy();
                this._texture = null;
            }

            this._file = file = GLib.uri_unescape_string(file, null);
            file = file.replace('file://', '');
            deskchanger.debug('setting preview to %s'.format(file));
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
                deskchanger.error(e, `Failed to set preview of ${file}`);
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

var StateButtonControl = GObject.registerClass(
class DeskChangerControlStateButtonControl extends ButtonControl {
    _init(states, callback) {
        if (states.length > 2) {
            RangeError('You must provide at least two states for the button');
        }

        this._states = states;
        this._state = 0;

        super._init(this._states[0].icon, () => {
            let state = this._state;

            if (++state >= this._states.length) {
                state = 0;
            }

            this._state = state;
            state = this._states[this._state].name;
            this.set_icon(this._states[this._state].icon);

            if (typeof callback === 'function') {
                callback(state);
            }
        });
    }

    set_state(state) {
        if (state === this._states[this._state].name) {
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
}
);