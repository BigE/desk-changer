'use strict';

const Gio = imports.gi.Gio;
const GIRepository = imports.gi.GIRepository;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

String.prototype.format = imports.format.format;

globalThis.deskchanger = {
    extdatadir: (() => {
        let m = /@(.+):\d+/.exec((new Error()).stack.split('\n')[1]);
        return Gio.File.new_for_path(m[1]).get_parent().get_path();
    })(),
    force_debug: false,

    /**
     * Implemented the two functions below using tweaked code from:
     * http://stackoverflow.com/a/13227808
     */
   getCaller: () => {
        let stack = deskchanger.getStack();

        // Remove superfluous function calls on stack
        stack.shift(); //deskchanger.getCaller --> deskchanger.getStack
        stack.shift(); //deskchanger.debug -->deskchanger.getCaller

        // Return caller's caller
        return stack[0];
    },
    getStack: () => {
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
    },
};

deskchanger.app_id = 'org.gnome.Shell.Extensions.DeskChanger';
deskchanger.app_path = '/org/gnome/Shell/Extensions/DeskChanger';
deskchanger.metadata = (() => {
    let data = GLib.file_get_contents(deskchanger.extdatadir + '/metadata.json')[1];

    return JSON.parse(imports.byteArray.toString(data));
})();

/**
 * Generic error handler that uses the gjs logError function
 *
 * @param exception
 * @param message
 */
deskchanger.error = (exception, message=null) => {
    let caller = deskchanger.getCaller();

    logError(exception, `[${deskchanger.metadata.uuid}/${caller.split('/').pop()}] ${message}`);
};

/**
 * Generic debug handler that checks settings to ensure debugging is enabled
 *
 * @param message
 * @param caller
 */
deskchanger.debug = (message, caller) => {
    if (deskchanger.force_debug || deskchanger.settings.debug) {
        let _caller = caller || deskchanger.getCaller(),
            method = _caller.substr(0, _caller.indexOf('@')),
            re = new RegExp(`^.*${deskchanger.metadata.uuid}/`);

        // do some magic to make it neat
        _caller = _caller.substr(_caller.indexOf('@')+1)
            .replace(re, '')
            .replace(/(:[0-9]+):[0-9]+$/gi, `@${method}$1`);

        log(`[${deskchanger.metadata.uuid}/${_caller}] ${message}`);
    }
};

function _findLibdir() {
    // Infer libdir by assuming gnome-shell shares a common prefix with gjs
    let searchPath = GIRepository.Repository.get_search_path();

    let libdir = searchPath.find(path => {
        return path.endsWith('/gjs/girepository-1.0');
    }).replace('/gjs/girepository-1.0', '');

    // Assume the parent directory if it's not there
    let path = GLib.build_filenamev([libdir, 'gnome-shell']);

    if (!GLib.file_test(path, GLib.FileTest.IS_DIR)) {
        let currentDir = `/${GLib.path_get_basename(libdir)}`;
        libdir = libdir.replace(currentDir, '');
    }

    return libdir;
}

if (!deskchanger.metadata.libdir) {
    deskchanger.metadata.libdir = _findLibdir();
    deskchanger.metadata.localedir = GLib.build_filenamev([deskchanger.extdatadir, 'locale']);
    deskchanger.metadata.gschemadir = GLib.build_filenamev([deskchanger.extdatadir, 'schemas']);
}

deskchanger.gschema = Gio.SettingsSchemaSource.new_from_directory(
    deskchanger.metadata.gschemadir,
    Gio.SettingsSchemaSource.get_default(),
    false
);

// gettext
imports.gettext.bindtextdomain(deskchanger.app_id, deskchanger.metadata.localedir);
const Gettext = imports.gettext.domain(deskchanger.app_id);
deskchanger._ = Gettext.gettext;

// settings
var Settings = GObject.registerClass(
class DeskChangerSettings extends Gio.Settings {
    get allowed_mime_types() {
        return this.get_value('allowed-mime-types').deep_unpack();
    }

    set allowed_mime_types(value) {
        this.set_value('allowed-mime-types', new GLib.Variant('as', value));
        deskchanger.debug(`set allowed-mime-types: ${value}`);
    }

    get auto_start() {
        return this.get_boolean('auto-start');
    }

    set auto_start(value) {
        value = Boolean(value);
        this.set_boolean('auto-start', value);
        deskchanger.debug(`set auto-start: ${value}`, deskchanger.getCaller());
    }

    get current_profile() {
        return this.get_string('current-profile');
    }

    set current_profile(value) {
        this.set_string('current-profile', value);
        deskchanger.debug(`set current-profile: ${value}`, deskchanger.getCaller());
    }

    get debug() {
        return this.get_boolean('debug');
    }

    set debug(value) {
        this.set_boolean('debug', Boolean(value));
        deskchanger.debug(`setdeskchanger.debug: ${value}`, deskchanger.getCaller());
    }

    get icon_preview() {
        return this.get_boolean('icon-preview');
    }

    set icon_preview(value) {
        this.set_boolean('icon-preview', Boolean(value));
        deskchanger.debug(`set icon-preview: ${value}`,deskchanger.getCaller());
    }

    get interval() {
        return this.get_int('interval');
    }

    set interval(value) {
        this.set_int('interval', value);
        deskchanger.debug(`set interval: ${value}`,deskchanger.getCaller());
    }

    get notifications() {
        return this.get_boolean('notifications');
    }

    set notifications(value) {
        value = Boolean(value);
        this.set_boolean('notifications', value);
        deskchanger.debug(`set notifications: ${value}`,deskchanger.getCaller());
    }

    get profile_state() {
        return this.get_value('profile-state').deep_unpack();
    }

    set profile_state(value) {
        this.set_value('profile-state', new GLib.Variant('a{sas}', value));
    }

    get profiles() {
        return this.get_value('profiles').deep_unpack();
    }

    set profiles(value) {
        this.set_value('profiles', new GLib.Variant('a{sa(sb)}', value));
        deskchanger.debug(`set profiles: ${value}`,deskchanger.getCaller());
    }

    get random() {
        return this.get_boolean('random');
    }

    set random(value) {
        value = Boolean(value);
        this.set_boolean('random', value);
        deskchanger.debug(`set random: ${value}`,deskchanger.getCaller());
    }

    get remember_profile_state() {
        return this.get_boolean('remember-profile-state');
    }

    set remember_profile_state(value) {
        value = Boolean(value);
        this.set_boolean('remember-profile-state', value);
        deskchanger.debug(`set remember-profile-state: ${value}`,deskchanger.getCaller());
    }

    get rotation() {
        return this.get_string('rotation');
    }

    set rotation(value) {
        this.set_string('rotation', value);
        deskchanger.debug(`set rotation: ${value}`,deskchanger.getCaller());
    }

    connect(signal, callback) {
        let handler_id = super.connect(signal, callback);

        deskchanger.debug(`connect ${signal} (${handler_id})`,deskchanger.getCaller());
        return handler_id;
    }

    disconnect(handler_id) {
        deskchanger.debug(`disconnect (${handler_id})`,deskchanger.getCaller());
        return super.disconnect(handler_id);
    }

    getKeybinding(name) {
        let array = this.get_strv(name);
        return (typeof  array[0] === 'undefined')? null : array[0];
    }

    setKeybinding(name, value) {
        this.set_strv(name, [value,]);
    }
}
);

deskchanger.settings = new Settings({
    settings_schema: deskchanger.gschema.lookup(deskchanger.app_id, true)
});

// Initialize our GResources file
Gio.Resource.load(
    GLib.build_filenamev([deskchanger.extdatadir, 'resources', `${deskchanger.app_id}.gresource`])
)._register();

deskchanger.get_resource = (path) => {
    let array = Gio.resources_lookup_data(
        GLib.build_filenamev([deskchanger.app_path, path]),
        Gio.ResourceLookupFlags.NONE
    ).toArray();

    // convert it to a string
    array = imports.byteArray.toString(array);
    // do some simple replacements
    array = array.replace('@EXTDATADIR@', deskchanger.extdatadir)
                 .replace('@APP_ID@', deskchanger.app_id)
                 .replace('@APP_PATH@', deskchanger.app_path);

    return array;
};

deskchanger.dbusxml = deskchanger.get_resource(`${deskchanger.app_id}.xml`);

// Initialize DBUS interfaces
deskchanger.dbusinfo = Gio.DBusNodeInfo.new_for_xml(deskchanger.dbusxml);

deskchanger.dbusinfo.nodes.forEach(info => info.cache_build());
