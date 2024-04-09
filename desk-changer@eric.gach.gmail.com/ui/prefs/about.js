import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import DeskChanger from '../../deskchanger.js';

const AboutPage = GObject.registerClass({
	GTypeName: 'AboutPage',
	InternalChildren: [
		'description_label',
		'url_label',
		'version_label',
	],
	Template: `resource:///org/gnome/Shell/Extensions/DeskChanger/ui/prefs/about.ui`,
},
class DeskChangerPreferencesAboutPage extends Adw.PreferencesPage {
	vfunc_realize(widget) {
		super.vfunc_realize();
		this._description_label.set_label(DeskChanger.metadata.description);
		this._url_label.set_label(`<a href="${DeskChanger.metadata.url}">${DeskChanger.metadata.url}</a>`);
		this._version_label.set_label(`Version ${DeskChanger.metadata.version}`);
	}
});

export default AboutPage;