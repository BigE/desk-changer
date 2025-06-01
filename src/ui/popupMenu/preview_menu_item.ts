import GObject from "gi://GObject";
import Graphene from "gi://Graphene";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import St from "gi://St";

import ControlPreview from "../control/preview.js";

export namespace PreviewMenuItem {
    export interface ConstructorProps extends PopupMenu.PopupBaseMenuItem.ConstructorProps {
        preview: string;
    }
}

export default class PreviewMenuItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerPopupMenuPreviewMenuItem",
            Properties: {
                "preview": GObject.param_spec_string(
                    "preview", "Preview",
                    "File URI to send to the preview control",
                    null, GObject.ParamFlags.READWRITE
                ),
            },
        }, this);
    }

    #box?: St.BoxLayout;
    #prefix?: St.Label;
    #preview: string|null;
    #preview_control?: ControlPreview;
    #preview_binding?: GObject.Binding;

    get preview(): string|null {
        return this.#preview;
    }

    set preview(value: string|null) {
        this.#preview = value;
        // automatically update the preview control when this is updated
        this.#remove_preview_control();
        this.#add_preview_control();
        this.notify('preview');
    }

    constructor(parameters?: Partial<PreviewMenuItem.ConstructorProps>) {
        const { preview, ...params } = parameters || {};

        params.reactive ??= true;
        super(params);

        this.#preview = preview || null;
        this.#box = new St.BoxLayout({vertical: true});
        this.add_child(this.#box);
        this.#prefix = new St.Label({text: "Open next wallpaper"});
        this.#box.add_child(this.#prefix);
        this.#add_preview_control();
    }

    destroy() {
        this.#remove_preview_control();
        this.#prefix?.destroy();
        this.#prefix = undefined;
        this.#box?.destroy();
        this.#box = undefined;
        super.destroy();
    }

    #add_preview_control() {
        // we must have the box and a preview file to continue, hide if not available
        if (!this.#box || !this.#preview) {
            this.hide();
            return;
        }

        this.#preview_control = new ControlPreview({preview_size: new Graphene.Size({height: -1, width: 200})});
        this.#preview_binding = this.bind_property('preview', this.#preview_control, 'preview_file', GObject.BindingFlags.SYNC_CREATE);
        this.#box.add_child(this.#preview_control);
        this.show();
    }

    #remove_preview_control() {
        if (this.#preview_binding) {
            this.#preview_binding.unbind();
            this.#preview_binding = undefined;
        }

        this.#preview_control?.destroy();
        this.#preview_control = undefined;
    }
}
