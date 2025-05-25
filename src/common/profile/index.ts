import Gio from "gi://Gio";
import GObject from "gi://GObject";

import {ProfileItemType} from "./item.js";

const Profile = GObject.registerClass(
{
    Properties: {
        "items": GObject.param_spec_object(
            "items", "Items",
            "All items contained within the profile",
            Gio.ListModel.$gtype, GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
        ),
        "name": GObject.param_spec_string(
            "name", "Name",
            "Name of the profile",
            null, GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
        ),
    },
},
class DeskChangerCommonProfile extends GObject.Object {
    private _items: Gio.ListStore<ProfileItemType>;
    private _name: string;

    get items(): Gio.ListStore<ProfileItemType> {
        return this._items;
    }

    get name() {
        return this._name;
    }

    set items(value: Gio.ListStore<ProfileItemType>) {
        this._items = value;
        this.notify('items');
    }

    set name(value: string) {
        this._name = value;
        this.notify('name');
    }

    constructor(name: string, items: Gio.ListStore<ProfileItemType> | null = null) {
        super();

        this._name = name;
        this._items = items || new Gio.ListStore<ProfileItemType>();
    }
}
);

export default Profile;
export type ProfileType = InstanceType<typeof Profile>;
