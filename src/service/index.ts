import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import {APP_PATH} from "../common/interface.js";
import { ServiceRunner } from "./runner.js";

export namespace Service {
    export interface ConstructorProps extends ServiceRunner.ConstructorProps {}
}

export default class Service extends ServiceRunner {
    #dbus?: Gio.DBusExportedObject;
    #dbus_id?: number;
    #dbus_name_owned: boolean;
    #signals: number[];

    static readonly SERVICE_ID = 'org.gnome.Shell.Extensions.DeskChanger.Service';
    static readonly SERVICE_PATH = "/org/gnome/Shell/Extensions/DeskChanger/Service";

    static {
        GObject.registerClass({
            GTypeName: "DeskChangerServiceDBus",
            Properties: {
                "dbus_name_owned": GObject.param_spec_boolean(
                    "dbus-name-owned", "DBus name owned",
                    "Boolean check if the DBus name is owned or not",
                    false, GObject.ParamFlags.READABLE
                ),
            }
        }, this);
    }

    static getDBusInterfaceXML(): string {
        return (new TextDecoder()).decode(Gio.resources_lookup_data(GLib.build_filenamev([
            APP_PATH,
            'service',
            `${Service.SERVICE_ID}.xml`
        ]), Gio.ResourceLookupFlags.NONE).toArray());
    }

    static getDBusInterfaceInfo(): Gio.DBusInterfaceInfo {
        const node_info = Gio.DBusNodeInfo.new_for_xml(Service.getDBusInterfaceXML());
        const dbus_info = node_info.lookup_interface(Service.SERVICE_ID);

        if (!dbus_info)
            throw new Error(_('DBUS: Failed to find interface info'));

        return dbus_info;
    }

    get dbus() {
        if (this.#dbus && this.is_dbus_name_owned())
            return this.#dbus;
        return undefined;
    }

    get dbus_name_owned() {
        return this.#dbus_name_owned;
    }

    constructor(properties: Service.ConstructorProps) {
        super(properties);
        this.#dbus_name_owned = false;
        this.#signals = [];

        const dbus_info = Service.getDBusInterfaceInfo();
        // wrapJSObject takes string|DBusInterfaceInfo
        // @ts-expect-error
        this.#dbus = Gio.DBusExportedObject.wrapJSObject(dbus_info, this);
        this.#dbus.export(Gio.DBus.session, Service.SERVICE_PATH);
    }

    destroy() {
        if (this.#dbus_id) {
            Gio.DBus.session.unown_name(this.#dbus_id);
            this.#dbus_id = undefined;
        }

        this.#dbus?.unexport();
        super.destroy();
        // ensure cleanup
        this.#on_name_lost();
        this.#dbus = undefined;
    }

    /**
     * Check if DBus name is owned
     *
     * This function is preferred over checking the dbus-name-owned property
     * since it also checks the internal dbus-id property.
     */
    is_dbus_name_owned() {
        return Boolean(this.#dbus_id && this.#dbus_name_owned);
    }

    /**
     * Own the DBus name
     */
    own_name() {
        if (!this.#dbus_id) {
            this.#dbus_id = Gio.DBus.session.own_name(
                Service.SERVICE_ID,
                Gio.BusNameOwnerFlags.REPLACE,
                this.#on_name_acquired.bind(this),
                this.#on_name_lost.bind(this)
            );
        }
    }

    #on_name_acquired() {
        this.#dbus_name_owned = true;

        // expose the property changes
        this.#signals.push(this.connect("notify::GameMode", () => {
            this.dbus?.emit_property_changed("GameMode", new GLib.Variant('b', this.GameMode));
        }));
        this.#signals.push(this.connect("notify::Preview", () => {
            this.dbus?.emit_property_changed('Preview', new GLib.Variant('s', this.Preview));
        }));
        this.#signals.push(this.connect('notify::Running', () => {
            this.dbus?.emit_property_changed('Running', new GLib.Variant('b', this.Running));
        }));
        // expose the signals
        this.#signals.push(this.connect('Changed', (_source, uri) => {
            this.dbus?.emit_signal('Changed', new GLib.Variant('(s)', [uri]));
        }));
        this.#signals.push(this.connect('Start', (_source, profile_name, preview) => {
            this.dbus?.emit_signal('Start', new GLib.Variant('(ss)', [profile_name, preview]));
        }));
        this.#signals.push(this.connect('Stop', () => {
            this.dbus?.emit_signal('Stop', new GLib.Variant('()', []));
        }));
    }

    #on_name_lost() {
        this.#dbus_name_owned = false;

        for (const signal of this.#signals) {
            this.disconnect(signal);
        }

        this.#signals = [];
    }
}
