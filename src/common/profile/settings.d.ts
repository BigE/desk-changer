export type ProfileSettingsItemType = [string, boolean];

type ProfileSettingsType = {
    [name: string]: ProfileSettingsItemType[];
}
export default ProfileSettingsType;
