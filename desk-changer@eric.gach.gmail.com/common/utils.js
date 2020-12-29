'use strict';

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

function _installFile(dirname, basename, contents) {
    try {
        let filename = GLib.build_filenamev([dirname, basename]);

        GLib.mkdir_with_parents(dirname, 0o755);
        return GLib.file_set_contents(filename, contents);
    } catch (e) {
        deskchanger.error(e, `failed to install ${basename} to ${dirname}`);
        return false;
    }
}

function _installResource(dirname, basename, relativePath) {
    try {
        let contents = getResource(relativePath);

        return _installFile(dirname, basename, contents);
    } catch (e) {
        deskchanger.error(e, `failed to install resource ${basename} to ${dirname}`);
        return false;
    }
}

function getResource(relativePath) {
    try {
        let bytes = Gio.resources_lookup_data(
                GLib.build_filenamev([deskchanger.app_path, relativePath]),
                Gio.ResourceLookupFlags.NONE
            ),
            source = ByteArray.toString(bytes.toArray());

        source = source.replace('@APP_ID@', deskchanger.app_id);
        return source.replace('@EXTDATADIR@', deskchanger.extdatadir);
    } catch (e) {
        deskchanger.error(e, `failed to get resource ${relativePath}`);
        return null;
    }
}

function installService() {
    let data_dir = GLib.get_user_data_dir(),
        dbus_dir = GLib.build_filenamev([data_dir, 'dbus-1', 'services']),
        dbus_file = `${deskchanger.app_id}.Daemon.service`;

    if (!_installResource(dbus_dir, dbus_file, `${dbus_file}.in`))
        throw Error(`failed to install ${dbus_file} to ${dbus_dir}`);
}
