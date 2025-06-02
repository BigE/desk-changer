import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";

import {APP_PATH} from "../../common/interface.js";
import ControlPreview from "../control/preview.js";
import Graphene from "gi://Graphene";

export namespace PanelMenuIcon {
    export interface ConstructorProps extends St.Bin.ConstructorProps {
        preview: string;
        preview_enabled: boolean;
    }
}

/**
 * Icon object for the indicator button
 *
 * This object will automatically update its child based on the two properties
 * that are exposed. The preview property should be set to the current preview
 * URI and if preview_enabled is true, the child element will be automatically
 * set to an icon preview of the URI. If preview_enabled is false then it will
 * automatically use the icon provided in the resources file.
 */
export default class PanelMenuIcon extends St.Bin {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPanelMenuIcon",
            Properties: {
                "preview": GObject.param_spec_string(
                    "preview", "Preview",
                    "The URI of the current preview, NULL if empty",
                    null, GObject.ParamFlags.READWRITE
                ),
                "preview_enabled": GObject.param_spec_boolean(
                    "preview_enabled", "Preview Enabled",
                    "Toggle for enabling the preview vs icon",
                    false, GObject.ParamFlags.READWRITE
                ),
            },
        }, this);
    }

    #icon?: St.Icon;
    #preview: string|null;
    #preview_file_binding?: GObject.Binding;
    #preview_control?: ControlPreview;
    #preview_enabled: boolean;

    get preview(): string|null {
        return this.#preview;
    }

    get preview_enabled(): boolean {
        return this.#preview_enabled;
    }

    set preview(value: string|null) {
        this.#preview = value;
        this.notify('preview');
    }

    set preview_enabled(value: boolean) {
        this.#preview_enabled = value;
        this.notify('preview_enabled');
        this.update_child();
    }

    constructor(parameters?: Partial<PanelMenuIcon.ConstructorProps>) {
        const {preview, preview_enabled, ...params} = parameters || {};

        params.style_class ??= "panel-status-menu-box";
        super(params);
        this.#preview = preview ?? null;
        this.#preview_enabled = preview_enabled ?? false;
        this.update_child();
    }

    destroy() {
        this.#destroy_preview();
        this.#destroy_icon();
        super.destroy();
    }

    update_child() {
        if (this.preview_enabled && this.preview) {
            try {
                this.#create_preview();
            } catch (e) {
                // fallback to the icon, it will clean up any preview items created
                this.#create_icon();
            }
        } else {
            this.#create_icon();
        }
    }

    #create_icon() {
        this.#icon = new St.Icon({
            gicon: Gio.Icon.new_for_string(`resource://${APP_PATH}/icons/wallpaper-icon.svg`),
            style_class: "system-status-icon",
        });
        this.set_child(this.#icon);
        this.#destroy_preview();
    }

    #create_preview() {
        this.#preview_control = new ControlPreview({preview_size: new Graphene.Size({height: 20, width: -1})});
        this.#preview_file_binding = this.bind_property('preview', this.#preview_control, 'preview_file', GObject.BindingFlags.SYNC_CREATE);
        this.set_child(this.#preview_control);
        this.#destroy_icon();
    }

    #destroy_icon() {
        this.#icon?.destroy();
        this.#icon = undefined;
    }

    #destroy_preview() {
        if (this.#preview_file_binding) {
            this.#preview_file_binding.unbind();
            this.#preview_file_binding = undefined;
        }

        this.#preview_control?.destroy();
        this.#preview_control = undefined;
    }
}
