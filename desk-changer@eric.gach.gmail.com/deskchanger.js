import GLib from "gi://GLib";
import Gtk from 'gi://Gtk?version=4.0'
import Gio from "gi://Gio";

const extdatadir = (() => {
	let m = /@(.+):\d+/.exec((new Error()).stack.split('\n')[1]);
	return Gio.File.new_for_uri(m[1]).get_parent().get_path();
})();

const gschemadir = GLib.build_filenamev([extdatadir, 'schemas']);

const gschema = Gio.SettingsSchemaSource.new_from_directory(
    gschemadir,
    Gio.SettingsSchemaSource.get_default(),
    false
);

const metadata = (() => {
	let data = GLib.file_get_contents(extdatadir + '/metadata.json')[1];
	return JSON.parse(new TextDecoder().decode(data));
})();

export default class DeskChanger
{
	static get app_id() { return "org.gnome.Shell.Extensions.DeskChanger"; }
	static get app_path() { return "/org/gnome/Shell/Extensions/DeskChanger"; }
	static get extdatadir() { return extdatadir; }
	static force_debug = false;
	static get gschema() { return gschema; }
	static get gschemadir() { return gschemadir; }
	static get metadata() { return metadata; }
	static get rotation() { return rotation; }
}

Gio.Resource.load(
	GLib.build_filenamev([DeskChanger.extdatadir, 'resources', `${DeskChanger.app_id}.gresource`])
)._register();

const builder = Gtk.Builder.new_from_resource(`${DeskChanger.app_path}/ui/rotation.ui`);
const rotation = builder.get_object('rotation');
