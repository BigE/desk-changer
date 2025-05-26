import Clutter from "gi://Clutter";
import Cogl from "gi://Cogl";
import GdkPixbuf from "gi://GdkPixbuf";
import GObject from "gi://GObject";
import St from "gi://St";

import Service from "../../service/index.js";
import GLib from "gi://GLib";

export type ControlPreviewSizeType = {
    height: number;
    width: number;
};

export default class ControlPreview extends St.Bin {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiControlPreview",
            Properties: {
                "file": GObject.param_spec_string(
                    "file", "File",
                    "File that the preview is currently displaying",
                    null, GObject.ParamFlags.READABLE
                ),
            }
        }, this);
    }

    #file?: string;
    #logger?: Console;
    #notify_preview_id?: number;
    #service?: Service;
    readonly #size: ControlPreviewSizeType;
    #texture?: Clutter.Actor;

    get file(): string | null {
        return this.#file || null;
    }

    constructor(size: ControlPreviewSizeType, service: Service, logger: Console) {
        super();
        this.#logger = logger;
        this.#service = service;
        this.#size = size;

        this.#notify_preview_id = this.#service.connect('notify::Preview', () => {
            if (this.#service?.Preview)
                return this.set_preview(this.#service.Preview);

            this.#texture?.destroy()
            this.#file = undefined;
            this.notify('file');
        });

        if (this.#service?.Preview)
            this.set_preview(this.#service.Preview);
    }

    destroy() {
        if (this.#notify_preview_id) {
            this.#service!.disconnect(this.#notify_preview_id);
            this.#notify_preview_id = undefined;
        }

        if (this.#texture) {
            this.#texture.destroy();
            this.#texture = undefined;
        }

        this.#logger = undefined;
        this.#service = undefined;
        super.destroy();
    }

    set_preview(wallpaper: string) {
        if (this.#texture) {
            this.#texture.destroy();
            this.#texture = undefined;
        }

        const file = (GLib.uri_unescape_string(wallpaper, null) || '').replace('file://', '');
        if (!file.length)
            return;

        try {
            const scale_factor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            let pixbuf: GdkPixbuf.Pixbuf | undefined = GdkPixbuf.Pixbuf.new_from_file(file);
            let { height, width } = this.#size;
            const original_size: ControlPreviewSizeType = { height: pixbuf.get_height(), width: pixbuf.get_width() };
            pixbuf = undefined;
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file, this.#size.width, this.#size.height, true);

            if (height > 0 && width === -1)
                width = Math.floor(original_size.width / (original_size.height / height));
            else if (width > 0 && height === -1)
                height = Math.floor(original_size.height / (original_size.width / width));

            const image = new St.ImageContent({
                preferred_height: height * scale_factor,
                preferred_width: width * scale_factor
            });
            image.set_data(
                global.stage.context.get_backend().get_cogl_context(),
                pixbuf.get_pixels(),
                (pixbuf.get_has_alpha()? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888),
                width * scale_factor,
                height * scale_factor,
                pixbuf.get_rowstride()
            );
            this.#texture = new Clutter.Actor({height: height * scale_factor, width: width * scale_factor});
            this.#texture.set_content(image);
            this.add_child(this.#texture);
        } catch (e) {
            this.#logger?.error(`Failed to set preview for ${wallpaper}: ${e}`);

            if (this.#texture) {
                this.#texture.destroy();
                this.#texture = undefined;
            }
        } finally {
            this.#file = file;
            this.notify('file');
        }
    }
}
