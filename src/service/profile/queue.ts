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

    append(item: ServiceProfileWallpaper | string) {
        if (typeof item === "string")
            return super.append(new ServiceProfileWallpaper(item));
        super.append(item);
    }

    dequeue(): ServiceProfileWallpaper {
        const item = this.get_item(0);

        if (!item)
            throw new TypeError('Failed to grab next queue item');

        this.remove(0);
        return item;
    }

    find(item: ServiceProfileWallpaper | string): [boolean, number] {
        if (typeof item === "string")
            return super.find(new ServiceProfileWallpaper(item));
        return super.find(item);
    }

    insert(position: number, item: ServiceProfileWallpaper | string) {
        if (typeof item === "string")
            return super.insert(position, new ServiceProfileWallpaper(item));
        super.insert(position, item);
    }
}
