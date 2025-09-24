import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AboutPage extends Adw.PreferencesPage {
    description_label: Gtk.Label | undefined;
    version_label: Gtk.Label | undefined;

    constructor(description: string | undefined, version: string | undefined) {
        super();

        // @ts-expect-error Bind property from resource file
        this.description_label = this._description_label;
        // @ts-expect-error Bind property from resource file
        this.version_label = this._version_label;

        console.log(description);
        if (description)
            this.description_label?.set_label(description);

        if (version)
            this.version_label?.set_label(_(`Version ${version}`));
    }
}
