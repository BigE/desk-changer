import GObject from "gi://GObject";


export default class CommonProfileItem extends GObject.Object {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerCommonProfileItem",
            Properties: {
                "recursive": GObject.param_spec_boolean(
                    "recursive", "Recursive",
                    "Toggle to recursively load the URI",
                    false, GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
                ),
                    "uri": GObject.param_spec_string(
                    "uri", "URI",
                    "URI to load into the profile",
                    null, GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
                ),
            }
        }, this);
    }

    private _recursive: boolean;
    private _uri: string;

    get recursive() {
        return this._recursive;
    }

    get uri() {
        return this._uri;
    }

    set recursive(value: boolean) {
        this._recursive = value;
        this.notify('recursive');
    }

    set uri(value: string) {
        this._uri = value;
        this.notify('uri');
    }

    constructor(uri: string, recursive: boolean = false) {
        super();

        this._recursive = recursive;
        this._uri = uri;
    }
}
