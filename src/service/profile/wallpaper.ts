import GObject from 'gi://GObject';

export default class ServiceProfileWallpaper extends GObject.Object {
    readonly #wallpaper: string;

    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerServiceProfileWallpaper',
                Properties: {
                    'wallpaper': GObject.param_spec_string(
                        'wallpaper',
                        'Wallpaper',
                        'Wallpaper URI',
                        null,
                        GObject.ParamFlags.READABLE
                    ),
                },
            },
            this
        );
    }

    get wallpaper(): string {
        return this.#wallpaper;
    }

    constructor(wallpaper: string) {
        super();
        this.#wallpaper = wallpaper;
    }

    toString() {
        return this.#wallpaper;
    }
}
