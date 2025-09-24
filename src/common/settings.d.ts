export type SettingsAllowedMimeTypesType = string[];

export type SettingsKeybindType = 'next-wallpaper' | 'previous-wallpaper';

export type SettingsProfileItemType = [string, boolean];

export type SettingsProfileState = {
    [name: string]: string[];
};

export type SettingsProfileType = {
    [name: string]: SettingsProfileItemType[];
};

export type SettingsRotationModes =
    | 'oneminute'
    | 'fiveminute'
    | 'thirtyminute'
    | 'onehour'
    | 'sixhour'
    | 'twelvehour'
    | 'twentyfourhour'
    | 'interval'
    | 'hourly'
    | 'daily'
    | 'disabled';
