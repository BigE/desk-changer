import GObject from "gi://GObject";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import St from "gi://St";
import ControlPreview from "../control/preview.js";
import Service from "../../service/index.js";

export default class PreviewMenuItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerPopupMenuPreviewMenuItem",
        }, this);
    }

    #box?: St.BoxLayout;
    #prefix?: St.Label;
    #preview?: ControlPreview;

    constructor(service: Service, logger: Console) {
        super({reactive: true});

        this.#box = new St.BoxLayout({vertical: true});
        this.add_child(this.#box);
        this.#prefix = new St.Label({text: "Open next wallpaper"});
        this.#box.add_child(this.#prefix);
        this.#preview = new ControlPreview({height: -1, width: 200}, service, logger);
        this.#box.add_child(this.#preview);
    }

    destroy() {
        this.#preview?.destroy();
        this.#preview = undefined;
        this.#prefix?.destroy();
        this.#prefix = undefined;
        this.#box?.destroy();
        this.#box = undefined;
        super.destroy();
    }
}
