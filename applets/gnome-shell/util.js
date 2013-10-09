const Me = imports.misc.extensionUtils.getCurrentExtension();
const current_version = imports.ui.main.shellDBusService.ShellVersion.split('.');

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

const version = function (version)
{
    version = version.split('.');

    for (var i = 0; i < version.length; i++) {
        if (current_version[i] != undefined) {
            if (parseInt(current_version[i]) > parseInt(version[i])) {
                return(1);
            } else if (parseInt(current_version[i]) < parseInt(version[i])) {
                return(-1);
            }
        } else {
            return(-1);
        }
    }

    return(0);
};