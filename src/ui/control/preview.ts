import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import GLib from 'gi://GLib';

export namespace ControlPreview {
    export interface ConstructorProps extends St.Bin.ConstructorProps {
        preview_file: string | null;
        preview_size: Graphene.Size;
    }
}

/**
 * Preview control to show a preview of the next wallpaper
 *
 * This control holds a texture object that will display the preview of the
 * next wallpaper. The preview control will watch the preview_file property for
 * any changes. When a change happens, it will cause an internal update to the
 * texture.
 */
export default class ControlPreview extends St.Bin {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiControlPreview',
                Properties: {
                    'preview-file': GObject.param_spec_string(
                        'preview-file',
                        'Preview File',
                        'File that the preview is currently displaying, NULL to disable',
                        null,
                        GObject.ParamFlags.READWRITE
                    ),
                    'preview-size': GObject.ParamSpec.boxed(
                        'preview-size',
                        'Preview Size',
                        'The size of the preview control',
                        GObject.ParamFlags.CONSTRUCT_ONLY |
                            GObject.ParamFlags.READABLE,
                        Graphene.Size.$gtype
                    ),
                },
            },
            this
        );
    }

    #preview_file: string | null;
    readonly #preview_size: Graphene.Size;
    #texture?: Clutter.Actor;

    get preview_file(): string | null {
        return this.#preview_file;
    }

    get preview_size(): Graphene.Size {
        return this.#preview_size;
    }

    set preview_file(value: string | null) {
        if (value) this.#set_preview(value);
        this.#preview_file = value;
        this.notify('preview-file');
    }

    constructor(parameters: Partial<ControlPreview.ConstructorProps>) {
        const {preview_file, preview_size, ...params} = parameters;

        if (!preview_size) throw new TypeError('Preview size must be defined');

        super(params);

        this.#preview_file = preview_file || null;
        this.#preview_size = preview_size;
        if (preview_file) this.#set_preview(preview_file);
    }

    destroy() {
        this.#destroy_texture();
        super.destroy();
    }

    #destroy_texture() {
        this.#texture?.destroy();
        this.#texture = undefined;
    }

    #set_preview(preview_file: string) {
        const file = (
            GLib.uri_unescape_string(preview_file, null) || ''
        ).replace('file://', '');

        if (!file.length) return;

        try {
            const scale_factor = St.ThemeContext.get_for_stage(
                global.stage
            ).scale_factor;
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                file,
                this.preview_size.width,
                this.preview_size.height,
                true
            );

            const image = new St.ImageContent({
                preferred_height: pixbuf.get_height() * scale_factor,
                preferred_width: pixbuf.get_width() * scale_factor,
            });
            image.set_data(
                global.stage.context.get_backend().get_cogl_context(),
                pixbuf.get_pixels(),
                pixbuf.get_has_alpha()
                    ? Cogl.PixelFormat.RGBA_8888
                    : Cogl.PixelFormat.RGB_888,
                pixbuf.get_width() * scale_factor,
                pixbuf.get_height() * scale_factor,
                pixbuf.get_rowstride()
            );
            const texture = new Clutter.Actor({
                height: pixbuf.get_height() * scale_factor,
                width: pixbuf.get_width() * scale_factor,
            });
            texture.set_content(image);
            this.#destroy_texture();
            this.#texture = texture;
            this.add_child(texture);
        } catch (e) {
            this.#destroy_texture();
            throw e;
        }
    }
}
