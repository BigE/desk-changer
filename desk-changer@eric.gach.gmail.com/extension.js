'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import DeskChanger from './deskchanger.js';
import Interface from './daemon/interface.js';
import { debug } from './common/logging.js';
import * as Utils from './common/utils.js';
import { makeProxyWrapper } from './service.js';
import {Button as DeskChangerPanelMenuButton} from './ui/panelMenu.js';

    // general
let daemon, button,
    // signals
    changed_id, current_profile_id, notifications_id, random_id, rotation_id;

export default class DeskChangerExtension extends Extension {
    disable() {
        debug('disabling extension');

        // button go bye bye
        if (button && typeof button.destroy === 'function') {
            button.destroy();
        }
        button = null;

        if (changed_id) {
            daemon.disconnectSignal(changed_id);
        }
        changed_id = null;

        if (current_profile_id) {
            Interface.settings.disconnect(current_profile_id);
        }
        current_profile_id = null;

        if (notifications_id) {
            Interface.settings.disconnect(notifications_id);
        }
        notifications_id = null;

        if (random_id) {
            Interface.settings.disconnect(random_id);
        }
        random_id = null;

        if (rotation_id) {
            Interface.settings.disconnect(rotation_id);
        }
        rotation_id = null;
    }

    enable() {
        debug('enabling extension');

        Utils.installService();
        daemon = makeProxyWrapper();

        changed_id = daemon.connectSignal('Changed', (proxy, name, [uri]) => {
            this.notify(_('Wallpaper changed: %s'.format(uri)));
        });

        current_profile_id = Interface.settings.connect('changed::current-profile', () => {
            this.notify(_('Profile changed to %s'.format(Interface.settings.current_profile)));
        });

        notifications_id = Interface.settings.connect('changed::notifications', () => {
            this.notify(((Interface.settings.notifications) ?
                _('Notifications are now enabled') :
                _('Notifications are now disabled')
            ), true);
        });

        random_id = Interface.settings.connect('changed::random', () => {
            this.notify(((Interface.settings.random)?
                _('Wallpapers will be shown in a random order') :
                _('Wallpapers will be shown in the order they were loaded')
            ));
        });

        rotation_id = Interface.settings.connect('changed::rotation', () => {
            let message, interval,
                rotation = Interface.settings.rotation,
                [success, iterator] = DeskChanger.rotation.get_iter_first();

            while (success) {
                if (DeskChanger.rotation.get_value(iterator, 0) === rotation) {
                    if (rotation === 'interval') {
                        interval = `${DeskChanger.rotation.get_value(iterator, 2)} of ${Interface.settings.interval} seconds`;
                    } else {
                        interval = DeskChanger.rotation.get_value(iterator, 2);
                    }

                    rotation = DeskChanger.rotation.get_value(iterator, 1);
                    break;
                }

                success = DeskChanger.rotation.iter_next(iterator);
            }

            switch (rotation) {
                case 'interval':
                    message = _(`Rotation will occur at a ${interval}`);
                    break;
                case 'hourly':
                    message = _('Rotation will occur at the beginning of every hour');
                    break;
                case 'daily':
                    message = _('Rotation will occur at the beginning of every day');
                    break;
                default:
                    message = _('Rotation has been disabled');
                    break;
            }

            this.notify(message);
        });

        button = new DeskChangerPanelMenuButton(daemon);
        Main.panel.addToStatusArea('DeskChanger', button);

        if (Interface.settings.auto_start && !daemon.Running) {
            daemon.StartSync();
        }
    }

    notify(message, force) {
        if (Interface.settings.notifications || force === true) {
            Main.notify('DeskChanger', message);
        }
    }
}
