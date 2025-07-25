import Gio from "gi://Gio";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import {APP_PATH} from "../common/interface.js";

export default class GameMode extends GObject.Object {
    #client_count_changed_id?: number;
    #enabled: boolean;
    #logger?: Console;
    #proxy?: Gio.DBusProxy;

    static readonly GAMEMODE_DBUS_IFACE = "com.feralinteractive.GameMode";
    static readonly GAMEMODE_DBUS_NAME = "com.feralinteractive.GameMode";
    static readonly GAMEMODE_DBUS_PATH = "/com/feralinteractive/GameMode";

    static {
        GObject.registerClass({
            GTypeName: "DeskChangerServiceGameMode",
            Properties: {
                "enabled": GObject.param_spec_boolean(
                    "enabled", "Enabled",
                    "Flag to indicate if GameMode is enabled",
                    false, GObject.ParamFlags.READABLE
                ),
            },
        }, this);
    }

    static getDBusInterfaceXML() {
        return (new TextDecoder()).decode(
            Gio.resources_lookup_data(GLib.build_filenamev([
                APP_PATH,
                `${GameMode.GAMEMODE_DBUS_IFACE}.xml`,
            ]), Gio.ResourceLookupFlags.NONE).toArray()
        );
    }

    get enabled(): boolean {
        return this.#enabled;
    }

    constructor(logger: Console) {
        super();

        this.#enabled = false;
        this.#logger = logger;
        const node_info = Gio.DBusNodeInfo.new_for_xml(GameMode.getDBusInterfaceXML());
        Gio.DBusProxy.new(
            Gio.DBus.session,
            Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            node_info.lookup_interface(GameMode.GAMEMODE_DBUS_NAME),
            GameMode.GAMEMODE_DBUS_NAME,
            GameMode.GAMEMODE_DBUS_PATH,
            GameMode.GAMEMODE_DBUS_IFACE,
            null,
            this._onProxyReady.bind(this)
        );
    }

    destroy() {
        if (this.#proxy) {
            if (this.#client_count_changed_id)
                this.#proxy.disconnect(this.#client_count_changed_id);
            this.#proxy.destroy();
        }

        this.#client_count_changed_id = undefined;
        this.#logger = undefined;
        this.#proxy = undefined;
    }

    _onClientCountChanged(proxy: Gio.DBusProxy, properties: GLib.Variant) {
        const unpacked = properties.deep_unpack<Record<"ClientCount", GLib.Variant>>();
        if (!('ClientCount' in unpacked))
            return;

        this.#enabled = (unpacked.ClientCount.deep_unpack<number>() > 0);
        this.notify('enabled');
    }

    _onProxyReady(o: any, res: Gio.AsyncResult) {
        try {
            this.#proxy = Gio.DBusProxy.new_finish(res);
        } catch (e) {
            this.#logger?.error("failed to create proxy for GameMode: {}".format(e));
            return;
        }

        this.#client_count_changed_id = this.#proxy?.connect("g-properties-changed", this._onClientCountChanged.bind(this));
        this.#enabled = (this.#proxy.ClientCount > 0);
        this.notify('enabled');
    }
}
