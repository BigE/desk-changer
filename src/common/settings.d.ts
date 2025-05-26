export type SettingsAllowedMimeTypesType = string[];

export type SettingsProfileItemType = [string, boolean];

export type SettingsProfileType = {
    [name: string]: SettingsProfileItemType[];
}

export type SettingsRotationModes = 'oneminute' | 'fiveminute' | 'thirtyminute' | 'onehour' | 'sixhour' | 'twelvehour' | 'twentyfourhour' | 'interval' | 'hourly' | 'daily' | 'disabled';
