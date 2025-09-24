import {SettingsRotationModes} from './settings.js';
import {ServiceTimerType} from '../service/timer/types.js';

type RotationModesType = {
    [_mode in SettingsRotationModes]: {
        label: string;
        interval?: number;
        timer?: ServiceTimerType;
    };
};

const RotationModes: RotationModesType = {
    oneminute: {
        label: 'One Minute',
        interval: 60,
        timer: 'interval',
    },
    fiveminute: {
        label: 'Five Minutes',
        interval: 300,
        timer: 'interval',
    },
    thirtyminute: {
        label: 'Thirty Minutes',
        interval: 1800,
        timer: 'interval',
    },
    onehour: {
        label: 'One Hour',
        interval: 3600,
        timer: 'interval',
    },
    sixhour: {
        label: 'Six Hours',
        interval: 21600,
        timer: 'interval',
    },
    twelvehour: {
        label: 'Twelve Hours',
        interval: 43200,
        timer: 'interval',
    },
    twentyfourhour: {
        label: '24 Hours',
        interval: 86400,
        timer: 'interval',
    },
    interval: {
        label: 'Interval',
        timer: 'interval',
    },
    hourly: {
        label: 'Hourly',
        timer: 'hourly',
    },
    daily: {
        label: 'Daily',
        timer: 'daily',
    },
    disabled: {
        label: 'Disabled',
    },
};
export default RotationModes;
