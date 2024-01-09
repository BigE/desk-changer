import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { debug } from './logging.js';
import { getCaller } from "./utils.js";
import DeskChanger from "../deskchanger.js";

let settings = null;

const Settings = GObject.registerClass({
	GTypeName: "DeskChangerSettings",
},
class DeskChangerSettings extends Gio.Settings {
	_init() {
		super._init({
			settings_schema: DeskChanger.gschema.lookup(DeskChanger.app_id, true),
		});
	}

    get allowed_mime_types() {
        return this.get_value('allowed-mime-types').recursiveUnpack();
    }

    set allowed_mime_types(value) {
        this.set_value('allowed-mime-types', new GLib.Variant('as', value));
        debug(`set allowed-mime-types: ${value}`);
    }

    get auto_start() {
        return this.get_boolean('auto-start');
    }

    set auto_start(value) {
        value = Boolean(value);
        this.set_boolean('auto-start', value);
        debug(`set auto-start: ${value}`, getCaller());
    }

    get current_profile() {
        return this.get_string('current-profile');
    }

    set current_profile(value) {
        this.set_string('current-profile', value);
        debug(`set current-profile: ${value}`, getCaller());
    }

    get debug() {
        return this.get_boolean('debug');
    }

    set debug(value) {
        this.set_boolean('debug', Boolean(value));
        debug(`setdebug: ${value}`, getCaller());
    }

    get icon_preview() {
        return this.get_boolean('icon-preview');
    }

    set icon_preview(value) {
        this.set_boolean('icon-preview', Boolean(value));
        debug(`set icon-preview: ${value}`,getCaller());
    }

    get interval() {
        return this.get_int('interval');
    }

    set interval(value) {
        this.set_int('interval', value);
        debug(`set interval: ${value}`,getCaller());
    }

    get notifications() {
        return this.get_boolean('notifications');
    }

    set notifications(value) {
        value = Boolean(value);
        this.set_boolean('notifications', value);
        debug(`set notifications: ${value}`,getCaller());
    }

    get profile_state() {
        return this.get_value('profile-state').recursiveUnpack();
    }

    set profile_state(value) {
        this.set_value('profile-state', new GLib.Variant('a{sas}', value));
    }

    get profiles() {
        return this.get_value('profiles').recursiveUnpack();
    }

    set profiles(value) {
        this.set_value('profiles', new GLib.Variant('a{sa(sb)}', value));
        debug(`set profiles: ${value}`,getCaller());
    }

    get random() {
        return this.get_boolean('random');
    }

    set random(value) {
        value = Boolean(value);
        this.set_boolean('random', value);
        debug(`set random: ${value}`,getCaller());
    }

    get remember_profile_state() {
        return this.get_boolean('remember-profile-state');
    }

    set remember_profile_state(value) {
        value = Boolean(value);
        this.set_boolean('remember-profile-state', value);
        debug(`set remember-profile-state: ${value}`,getCaller());
    }

    get rotation() {
        return this.get_string('rotation');
    }

    set rotation(value) {
        this.set_string('rotation', value);
        debug(`set rotation: ${value}`,getCaller());
    }

    connect(signal, callback) {
        let handler_id = super.connect(signal, callback);

        debug(`connect ${signal} (${handler_id})`,getCaller());
        return handler_id;
    }

    disconnect(handler_id) {
        debug(`disconnect (${handler_id})`,getCaller());
        return super.disconnect(handler_id);
    }

    getKeybinding(name) {
        let array = this.get_strv(name);
        return (typeof  array[0] === 'undefined')? null : array[0];
    }

    setKeybinding(name, value) {
        this.set_strv(name, [value,]);
    }

	get singleton() {
		if (!settings)
			settings = new Settings();

		return settings;
	}
}
);

export default Settings;