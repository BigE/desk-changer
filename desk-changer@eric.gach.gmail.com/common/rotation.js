import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

const RotationMode = new GObject.registerClass({
	Properties: {
		'key': GObject.param_spec_string(
			'key',
			'Key',
			'Rotation mode identifier',
			null,
			GObject.ParamFlags.READWRITE
		),
		'rotation': GObject.param_spec_string(
			'rotation',
			'Rotation',
			'Rotation mode type for daemon',
			null,
			GObject.ParamFlags.READWRITE
		),
		'label': GObject.param_spec_string(
			'label',
			'Label',
			'Label for rotation mode',
			null,
			GObject.ParamFlags.READWRITE
		),
		'interval': GObject.param_spec_uint(
			'interval',
			'Interval',
			'Interval value to pass to daemon',
			0,
			86400,
			0,
			GObject.ParamFlags.READWRITE
		),
	}
},
class DeskChangerRotationMode extends GObject.Object {
	constructor(params={key: null, rotation: null, label: null, interval: 0}) {
		super();

		this._key = params['key'];
		this._rotation = params['rotation'];
		this._label = params['label'];
		this._interval = params['interval'];
	}

	get interval() {
		return this._interval;
	}

	get key() {
		return this._key;
	}

	get label() {
		return this._label;
	}

	get rotation() {
		return this._rotation;
	}
});

const RotationModes = Gio.ListStore.new(RotationMode);

RotationModes.append(new RotationMode({
	key: 'oneminute',
	rotation: 'interval',
	label: 'One minute interval',
	interval: 60,
}));

RotationModes.append(new RotationMode({
	key: 'fiveminute',
	rotation: 'interval',
	label: 'Five minute interval',
	interval: 300,
}));

RotationModes.append(new RotationMode({
	key: 'thirtyminute',
	rotation: 'interval',
	label: '30 Minute Interval',
	interval: 1800,
}));
RotationModes.append(new RotationMode({
	key: 'onehour',
	rotation: 'interval',
	label: '1 Hour Interval',
	interval: '3600',
}));
RotationModes.append(new RotationMode({
	key: 'sixhour',
	rotation: 'interval',
	label: '6 Hour Interval',
	interval: '21600',
}));
RotationModes.append(new RotationMode({
	key: 'twelvehour',
	rotation: 'interval',
	label: '12 Hour Interval',
	interval: '43200',
}));
RotationModes.append(new RotationMode({
	key: 'twentyfourhour',
	rotation: 'interval',
	label: '24 Hour Interval',
	interval: '86400',
}));
RotationModes.append(new RotationMode({
	key: 'interval',
	rotation: 'interval',
	label: 'Custom Interval',
	interval: '0',
}));
RotationModes.append(new RotationMode({
	key: 'hourly',
	rotation: 'hourly',
	label: 'Hourly Timer',
	interval: '0',
}));
RotationModes.append(new RotationMode({
	key: 'daily',
	rotation: 'daily',
	label: 'Daily Timer',
	interval: '0',
}));
RotationModes.append(new RotationMode({
	key: 'disabled',
	rotation: 'disabled',
	label: 'Disabled',
	interval: '0',
}));

export default RotationModes;