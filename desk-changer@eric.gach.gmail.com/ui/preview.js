const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const GLib = imports.gi.GLib;
const GdkPixbuf = imports.gi.GdkPixbuf;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

var Preview = GObject.registerClass(
class DeskChangerPreview extends St.Bin {
    _init(width, daemon, callback) {
        super._init({ x_align: St.Align.MIDDLE });
        this._file = null;
        this._callback = callback;
        this._daemon = daemon;
        this._texture = null;
        this._width = width;
        this._next_file_id = this._daemon.desktop_profile.connect('preview', (daemon, uri) => {
            this.set_wallpaper(uri);
        });
        this._toggled_id = this._daemon.connect('toggled', (daemon) => {
            if (!daemon.running && this._texture) {
                Utils.debug('clearing preview, daemon stopped');
                this._texture.destroy();
                this._texture = null;
            }
        });

        if (daemon.desktop_profile.preview) {
            this.set_wallpaper(this._daemon.desktop_profile.preview);
        }

        this.set_child(this._texture);
    }

    destroy() {
        if (this._next_file_id) {
            this._daemon.desktop_profile.disconnect(this._next_file_id);
        }
        this._next_file_id = null;

        if (this._toggled_id) {
            this._daemon.disconnect(this._toggled_id);
        }
        this._toggled_id = null;

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
        Utils.debug('setting preview to %s'.format(file));
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
