import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import { Location } from '../profiles.js';

const LocationRow = GObject.registerClass({
	GTypeName: 'LocationRow',
	InternalChildren: [
		'recursive_switch',
		'remove_button',
	],
	Properties: {
		'location': GObject.param_spec_object(
			'location',
			'Location',
			'Location object belonging to the model',
			Location,
			GObject.ParamFlags.READWRITE
		),
	},
	Template: `file:///home/eric/Projects/desk-changer/resources/ui/common/location_row.ui`,
},
class DeskChangerLocationRow extends Adw.ActionRow {
	constructor(params = {}) {
		let location = null;

		if ('location' in params) {
			location = params['location'];
			delete params['location'];
		}

		super(params);

		this._location = location;
	}

	get recursive_switch() {
		return this._recursive_switch;
	}

	get remove_button() {
		return this._remove_button;
	}

	get_location() {
		if (this._location === undefined)
			this._location = null;

		return this._location;
	}

	set_location(value) {
		if (this._location === value) return;

		this._location = value;
		this.notify('location');
	}
});

export default LocationRow;