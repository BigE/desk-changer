const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

function error(exception, message=null) {
    let output = null;

    if (message) {
        let caller = Convenience.getCaller();
        output = `[${Me.metadata.uuid}/${caller.split('/').pop()}] ${message}`;
    }

    logError(exception, output);
}

function debug(message) {
    let settings = Convenience.getSettings();

    if (settings.get_boolean('debug')) {
        let caller = Convenience.getCaller(),
            output = `[${Me.metadata.uuid}/${caller.split('/').pop()}] ${message}`;

        log(output);
    }
}