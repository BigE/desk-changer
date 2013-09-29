const Me = imports.misc.extensionUtils.getCurrentExtension();

const debug = function (output)
{
	var date = new Date();
	output = '['+date.toLocaleString()+'] '+Me.metadata.uuid+': '+output;
	log(output);
};

const error = function (error)
{
	var stack = (new Error()).stack;

	debug('ERROR: '+error);
	debug('STACK: '+stack);
};