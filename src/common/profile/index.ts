import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import ProfileItem from './item.js';

export default class CommonProfile extends GObject.Object {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerCommonProfile',
                Properties: {
                    items: GObject.param_spec_object(
                        'items',
                        'Items',
                        'All items contained within the profile',
                        Gio.ListModel.$gtype,
                        GObject.ParamFlags.READWRITE |
                            GObject.ParamFlags.CONSTRUCT
                    ),
                    name: GObject.param_spec_string(
                        'name',
                        'Name',
                        'Name of the profile',
                        null,
                        GObject.ParamFlags.READWRITE |
                            GObject.ParamFlags.CONSTRUCT
                    ),
                },
            },
            this
        );
    }

    private _items: Gio.ListStore<ProfileItem>;
    private _name: string;

    get items(): Gio.ListStore<ProfileItem> {
        return this._items;
    }

    get name() {
        return this._name;
    }

    set items(value: Gio.ListStore<ProfileItem>) {
        this._items = value;
        this.notify('items');
    }

    set name(value: string) {
        this._name = value;
        this.notify('name');
    }

    constructor(name: string, items: Gio.ListStore<ProfileItem> | null = null) {
        super();

        this._name = name;
        this._items = items || new Gio.ListStore<ProfileItem>();
    }
}
