import GObject from "gi://GObject";
import Gio from "gi://Gio";

import RotationModes from "../../../common/rotation_modes.js";
import {SettingsRotationModes} from "../../../common/settings.js";
import {ServiceTimerType} from "../../../service/timer/types.js";

export class RotationModeObject extends GObject.Object {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsCommonRotationModeObject",
            Properties: {
                "mode": GObject.param_spec_string(
                    "mode", "Mode",
                    "Rotation mode identifier",
                    null, GObject.ParamFlags.READABLE
                ),
                "label": GObject.param_spec_string(
                    "label", "Label",
                    "Readable label for the rotation mode",
                    null, GObject.ParamFlags.READABLE
                ),
                "interval": GObject.param_spec_uint(
                    "interval", "Interval",
                    "Interval to be used with the rotation mode or 0 to disable",
                    0, 86400, 0, GObject.ParamFlags.READABLE
                ),
                "timer": GObject.param_spec_string(
                    "timer", "Timer",
                    "Timer object to use with the interval",
                    null, GObject.ParamFlags.READABLE
                ),
            },
        }, this);
    }

    readonly #mode: SettingsRotationModes;
    readonly #label: string;
    readonly #interval?: number;
    readonly #timer?: ServiceTimerType;

    get label(): string {
        return this.#label;
    }

    get interval(): number {
        return this.#interval || 0;
    }

    get mode(): SettingsRotationModes {
        return this.#mode;
    }

    get timer(): ServiceTimerType | null {
        return this.#timer || null;
    }

    constructor(mode: SettingsRotationModes, label: string, interval?: number, timer?: ServiceTimerType) {
        super();

        this.#label = label;
        this.#interval = interval;
        this.#mode = mode;
        this.#timer = timer;
    }
}

export default class RotationModeListStore extends Gio.ListStore {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsCommonRotationModeListStore",
        }, this);
    }

    constructor(params?: Partial<Gio.ListStore.ConstructorProps>) {
        super(params);

        for (const rotation_mode in RotationModes) {
            const mode = <SettingsRotationModes>rotation_mode;
            this.append(new RotationModeObject(mode, RotationModes[mode].label, RotationModes[mode].interval, RotationModes[mode].timer));
        }
    }
}
