import Interface from "../daemon/interface.js";
import { getCaller } from "./utils.js";

export function debug(message, caller = null) {
	if (Interface.force_debug || Interface.settings.debug) {
		let _caller = caller || getCaller(),
			method = _caller.substring(0, _caller.indexOf('@')),
			re = new RegExp(`^.*${Interface.metadata.uuid}/`);

		// do some magic to make it neat
		_caller = _caller.substring(_caller.indexOf('@') + 1)
			.replace(re, '')
			.replace(/(:[0-9]+):[0-9]+$/gi, `@${method}$1`);

		console.log(`[${Interface.metadata.uuid}/${_caller}] ${message}`);
	}
}

export function error(exception, message = null) {
	let caller = getCaller();

	console.error(`[] ${message}`, exception);
}