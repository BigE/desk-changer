import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

export const Location = GObject.registerClass(
{
	Properties: {
		'location': GObject.ParamSpec.string(
			'location',
			'Location',
			'URI of the location for the daemon to load',
			GObject.ParamFlags.READWRITE | GObject.ParamSpec.CONSTRUCT,
			null
		),
		'recursive': GObject.ParamSpec.boolean(
			'recursive',
			'Recursive',
			'Tell the daemon to load the location recursively',
			GObject.ParamFlags.READWRITE | GObject.ParamSpec.CONSTRUCT,
			false
		),
	}
},
class DeskChangerLocation extends GObject.Object {
	get location() {
		if (this._location === undefined)
			this._location = null;

		return this._location;
	}

	get recursive() {
		return this._recursive;
	}

	set location(value) {
		if (this._location === value) return;

		this._location = value;
		this.notify('location');
	}

	set recursive(value) {
		if (this._recursive === value) return;

		this._recursive = value;
		this.notify('recursive');
	}
}
);

export const Profile = GObject.registerClass({
    GTypeName: 'Profile',
    Properties: {
		'locations': GObject.param_spec_object(
			'locations',
			'Locations',
			'Locations that are contained within the profile',
			Gio.ListModel,
			GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT
		),
        'name': GObject.ParamSpec.string(
            'name',
            'Name',
            'Profile name to be displayed',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            null
        ),
    },
},
class DeskChangerProfile extends GObject.Object {
	get locations() {
		if (this._locations === undefined)
			this._locations = null;

		return this._locations;
	}

    get name() {
        if (this._name === undefined)
            this._name = null;

        return this._name;
    }

	set locations(value) {
		if (this._locations === value) return;
		
		this._locations = value;
		this.notify('locations');
	}

    set name(value) {
        if (this._name === value) return;

        this._name = value;
        this.notify('name');
    }
});