'use strict';

import Gio from "gi://Gio";

import DeskChanger from "../deskchanger.js";
import { getResource } from "../common/utils.js";
import Settings from "../common/settings.js";

const settings = new Settings();

export default class Interface extends DeskChanger {
	static get app_id() { return `${DeskChanger.app_id}.Daemon`; }
	static get app_path() { return `${DeskChanger.app_path}/Daemon`; }
	static get dbusinfo() { return dbusinfo; }
	static get dbusxml() { return dbusxml; }
	static get settings() { return settings; }
}

const dbusxml = getResource(`${Interface.app_id}.xml`, Interface.app_id, Interface.app_path);
const dbusinfo = Gio.DBusNodeInfo.new_for_xml(dbusxml);
dbusinfo.nodes.forEach(info => info.cache_build());
