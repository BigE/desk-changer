import {SettingsRotationModes} from "./settings.js";
import {ServiceTimerType} from "../service/timer/types.js";

type RotationModesType = {
    [mode in SettingsRotationModes]: {
        label: string;
        interval?: number;
        timer?: ServiceTimerType;
    };
};

const RotationModes: RotationModesType = {
    oneminute: {
        label: "",
        interval: 60,
        timer: "interval"
    },
    fiveminute: {
        label: "",
        interval: 300,
        timer: "interval"
    },
    thirtyminute: {
        label: "",
        interval: 1800,
        timer: "interval"
    },
    onehour: {
        label: "",
        interval: 3600,
        timer: "interval"
    },
    sixhour: {
        label: "",
        interval: 21600,
        timer: "interval"
    },
    twelvehour: {
        label: "",
        interval: 43200,
        timer: "interval"
    },
    twentyfourhour: {
        label: "",
        interval: 86400,
        timer: "interval"
    },
    interval: {
        label: "Interval",
        timer: "interval"
    },
    hourly: {
        label: "",
        timer: "daily"
    },
    daily: {
        label: "",
        timer: "daily"
    },
    disabled: {
        label: "Disabled",
    }
};
export default RotationModes;
