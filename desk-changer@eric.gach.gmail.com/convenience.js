/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
  Copyright (c) 2011-2012, Giovanni Campagna <scampa.giovanni@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the GNOME nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;

/**
 * initTranslations:
 * @domain: (optional): the gettext domain to use
 *
 * Initialize Gettext to load translations from extensionsdir/locale.
 * If @domain is not provided, it will be taken from metadata['gettext-domain']
 */
function initTranslations(domain) {
    let extension = ExtensionUtils.getCurrentExtension();

    domain = domain || extension.metadata['gettext-domain'];

    // check if this extension was built with "make zip-file", and thus
    // has the locale files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell
    let localeDir = extension.dir.get_child('locale');
    if (localeDir.query_exists(null)) {
        Gettext.bindtextdomain(domain, localeDir.get_path());
    } else {
        Gettext.bindtextdomain(domain, Config.LOCALEDIR);
    }
}

/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for @schema, using schema files
 * in extensionsdir/schemas. If @schema is not provided, it is taken from
 * metadata['settings-schema'].
 */
function getSettings(schema) {
    let extension = ExtensionUtils.getCurrentExtension();

    schema = schema || extension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    // check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
                                                 GioSSS.get_default(),
                                                 false);
    } else {
        schemaSource = GioSSS.get_default();
    }

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        throw new Error(`Schema ${schema} could not be found for extension ${extension.metadata.uuid}. Please check your installation.`);
    }

    return new Settings({settings_schema: schemaObj});
}

function debug(message, caller) {
    let extension = ExtensionUtils.getCurrentExtension(),
        output = `[${extension.metadata.uuid}/${caller.split('/').pop()}] ${message}`;

    log(output);
}

let Settings = GObject.registerClass(
class DeskChangerSettings extends Gio.Settings {
    get allowed_mime_types() {
        return this.get_value('allowed-mime-types').deep_unpack();
    }

    set allowed_mime_types(value) {
        this.set_value('allowed-mime-types', new GLib.Variant('as', value));
    }

    get auto_start() {
        return this.get_boolean('auto-start');
    }

    set auto_start(value) {
        value = Boolean(value);
        this.set_boolean('auto-start', value);

        if (this.debug) {
            let caller = getCaller();
            debug(`set auto-start: ${value}`, getCaller());
        }
    }

    get current_profile() {
        return this.get_string('current-profile');
    }

    set current_profile(value) {
        this.set_string('current-profile', value);

        if (this.debug) {
            debug(`set current-profile: ${value}`, getCaller());
        }
    }

    get debug() {
        return this.get_boolean('debug');
    }

    set debug(value) {
        this.set_boolean('debug', Boolean(value));
        debug(`set debug: ${value}`, getCaller());
    }

    get icon_preview() {
        return this.get_boolean('icon-preview');
    }

    set icon_preview(value) {
        this.set_boolean('icon-preview', Boolean(value));

        if (this.debug) {
            debug(`set icon-preview: ${value}`, getCaller());
        }
    }

    get interval() {
        return this.get_int('interval');
    }

    set interval(value) {
        this.set_int('interval', value);

        if (this.debug) {
            debug(`set interval: ${value}`, getCaller());
        }
    }

    get lockscreen_profile() {
        return this.get_string('lockscreen-profile');
    }

    set lockscreen_profile(value) {
        this.set_string('lockscreen-profile', value);

        if (this.debug) {
            debug(`set lockscreen-profile: ${value}`, getCaller());
        }
    }

    get notifications() {
        return this.get_boolean('notifications');
    }

    set notifications(value) {
        value = Boolean(value);
        this.set_boolean('notifications', value);

        if (this.debug) {
            debug(`set notifications: ${value}`, getCaller());
        }
    }

    get profile_state() {
        return this.get_value('profile-state').deep_unpack();
    }

    set profile_state(value) {
        this.set_value('profile-state', new GLib.Variant('a{s(ss)}', value));
    }

    get profiles() {
        return this.get_value('profiles').deep_unpack();
    }

    set profiles(value) {
        this.set_value('profiles', new GLib.Variant('a{sa(sb)}', value));

        if (this.debug) {
            debug(`set profiles: ${value}`, getCaller());
        }
    }

    get random() {
        return this.get_boolean('random');
    }

    set random(value) {
        value = Boolean(value);
        this.set_boolean('random', value);

        if (this.debug) {
            debug(`set random: ${value}`, getCaller());
        }
    }

    get remember_profile_state() {
        return this.get_boolean('remember-profile-state');
    }

    set remember_profile_state(value) {
        value = Boolean(value);

        this.set_boolean('remember-profile-state', value);

        if (this.debug) {
            debug(`set remember-profile-state: ${value}`, getCaller());
        }
    }

    get rotation() {
        return this.get_string('rotation');
    }

    set rotation(value) {
        this.set_string('rotation', value);

        if (this.debug) {
            debug(`set rotation: ${value}`, getCaller());
        }
    }

    get update_lockscreen() {
        return this.get_boolean('update-lockscreen');
    }

    set update_lockscreen(value) {
        value = Boolean(value);
        this.set_boolean('update-lockscreen', value);

        if (this.debug) {
            debug(`set update-lockscreen: ${value}`, getCaller());
        }
    }

    connect(signal, callback) {
        let handler_id = super.connect(signal, callback);

        if (this.debug) {
            let caller = getCaller();
            debug(`connect ${signal} (${handler_id})`, getCaller());
        }

        return handler_id;
    }

    disconnect(handler_id) {
        if (this.debug) {
            debug(`disconnect (${handler_id})`, getCaller());
        }

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

/**
 * Implemented the two functions below using tweaked code from:
 * http://stackoverflow.com/a/13227808
 */

function getCaller() {
    let stack = getStack();

    // Remove superfluous function calls on stack
    stack.shift(); // getCaller --> getStack
    stack.shift(); // debug --> getCaller

    // Return caller's caller
    return stack[0];
}

function getStack() {
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

function checkShellVersion(version, comparison) {
    let shell_version = Config.PACKAGE_VERSION,
        shell_version_major = shell_version.split('.')[0],
        shell_version_minor = shell_version.split('.')[1],
        compare_version_major = version.split('.')[0],
        compare_version_minor = version.split('.')[1];

    switch (comparison) {
        case '>':
            return shell_version_major > compare_version_major && shell_version_minor > compare_version_minor;
        case '<':
            return shell_version_major < compare_version_major && shell_version_minor < compare_version_minor;
        case '<=':
            return shell_version_major <= compare_version_major && shell_version_minor <= compare_version_minor;
        case '>=':
            return shell_version_major >= compare_version_major && shell_version_minor >= compare_version_minor;
        case '!=':
            return shell_version_major != compare_version_major && shell_version_minor != compare_version_minor;
        case '!==':
            return shell_version_major !== compare_version_major && shell_version_minor !== compare_version_minor;
        case '===':
            return shell_version_major === compare_version_major && shell_version_minor === compare_version_minor;
        case '==':
        default:
            return shell_version_major == compare_version_major && shell_version_minor == compare_version_minor;
    }
}
