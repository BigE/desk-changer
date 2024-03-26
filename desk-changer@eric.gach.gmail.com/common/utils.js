'use strict';

import Gio from "gi://Gio";
import GLib from "gi://GLib";

import DeskChanger from "../deskchanger.js";
import { error } from "./logging.js";

/**
 * Implemented the two functions below using tweaked code from:
 * http://stackoverflow.com/a/13227808
 */
export function getCaller() {
    let stack = getStack();

    // Remove superfluous function calls on stack
    stack.shift(); // getCaller --> getStack
    stack.shift(); // <caller> --> getCaller

    // Return caller's caller
    return stack[0];
}

export function getStack() {
    // Save original Error.prepareStackTrace
    let origPrepareStackTrace = Error.prepareStackTrace;

    // Override with function that just returns `stack`
    Error.prepareStackTrace = function (_, stack) {
        return stack;
    };

    // Create a new `Error`, which automatically gets `stack`
    let err = new Error();

    // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
    let stack = err.stack.split("\n");

    // Restore original `Error.prepareStackTrace`
    Error.prepareStackTrace = origPrepareStackTrace;

    // Remove superfluous function call on stack
    stack.shift(); // getStack --> Error

    return stack
}

export function getResource(relativePath, app_id = null, app_path = null) {
    try {
        let bytes = Gio.resources_lookup_data(
                GLib.build_filenamev([app_path || DeskChanger.app_path, relativePath]),
                Gio.ResourceLookupFlags.NONE
            ),
            source = new TextDecoder().decode(bytes.toArray());

        return source
            .replace('@APP_ID@', app_id || DeskChanger.app_id)
            .replace('@APP_PATH@', app_path || DeskChanger.app_path)
            .replace('@EXTDATADIR@', DeskChanger.extdatadir);
    } catch (e) {
        error(e, `failed to get resource ${relativePath}`);
        return null;
    }
}

export function installService() {
    let data_dir = GLib.get_user_data_dir(),
        dbus_dir = GLib.build_filenamev([data_dir, 'dbus-1', 'services']),
        dbus_file = `${DeskChanger.app_id}.Daemon.service`;

    if (!_installResource(dbus_dir, dbus_file, `${dbus_file}.in`))
        throw Error(`failed to install ${dbus_file} to ${dbus_dir}`);
}

function _installFile(dirname, basename, contents) {
    try {
        let filename = GLib.build_filenamev([dirname, basename]);

        GLib.mkdir_with_parents(dirname, 0o755);
        return GLib.file_set_contents(filename, contents);
    } catch (e) {
        error(e, `failed to install ${basename} to ${dirname}`);
        return false;
    }
}

function _installResource(dirname, basename, relativePath) {
    try {
        let contents = getResource(relativePath);

        return _installFile(dirname, basename, contents);
    } catch (e) {
        error(e, `failed to install resource ${basename} to ${dirname}`);
        return false;
    }
}
