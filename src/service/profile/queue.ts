import Gio from "gi://Gio";
import GObject from "gi://GObject";
import ServiceProfileWallpaper from "./wallpaper.js";

export default class ServiceProfileQueue extends Gio.ListStore<ServiceProfileWallpaper> {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerServiceProfileQueue",
            Properties: {
                "next": GObject.param_spec_string(
                    "next", "Next",
                    "Next item in queue object",
                    null, GObject.ParamFlags.READABLE
                )
            },
        }, this);
    }

    get next(): string | null {
        return this.get_item(0)?.wallpaper || null;
    }

    constructor() {
        super({item_type: ServiceProfileWallpaper.$gtype});
    }

    dequeue(): ServiceProfileWallpaper {
        const item = this.get_item(0);

        if (!item)
            throw new TypeError(_("Failed to grab next queue item"));

        this.remove(0);
        return item;
    }
}
