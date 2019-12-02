/**
 * Copyright (c) 2014-2018 Eric Gach <eric.gach@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata.uuid);
const Utils = Me.imports.utils;
const Convenience = Me.imports.convenience;
const DeskChangerDaemon = Me.imports.daemon.server.Daemon;
const DeskChangerPanelMenuButton = Me.imports.ui.panelMenu.Button;

const Main = imports.ui.main;
const _ = Gettext.gettext;

    // general
let settings, daemon, button,
    // signals
    changed_id, current_profile_id, notifications_id, random_id, rotation_id;

function disable() {
    Utils.debug('disabling extension');

    // button go bye bye
    if (typeof button.destroy === 'function') {
        button.destroy();
    }
    button = null;

    if (changed_id) {
        daemon.disconnect(changed_id);
    }
    changed_id = null;

    if (current_profile_id) {
        settings.disconnect(current_profile_id);
    }
    current_profile_id = null;

    if (notifications_id) {
        settings.disconnect(notifications_id);
    }
    notifications_id = null;

    if (random_id) {
        settings.disconnect(random_id);
    }
    random_id = null;

    if (rotation_id) {
        settings.disconnect(rotation_id);
    }
    rotation_id = null;
}

function enable() {
    Utils.debug('enabling extension');

    if (settings.auto_start && !daemon.running) {
        daemon.start();
    }

    changed_id = daemon.connect('changed', function (obj, file) {
        notify(_('Wallpaper changed: %s'.format(file)));
    });

    current_profile_id = settings.connect('changed::current-profile', function () {
        notify(_('Profile changed to %s'.format(settings.current_profile)));
    });

    notifications_id = settings.connect('changed::notifications', function () {
        notify(((settings.notifications) ?
            _('Notifications are now enabled') :
            _('Notifications are now disabled')
        ), true);
    });

    random_id = settings.connect('changed::random', function () {
        notify(((settings.random)?
            _('Wallpapers will be shown in a random order') :
            _('Wallpapers will be shown in the order they were loaded')
        ));
    });

    rotation_id = settings.connect('changed::rotation', function () {
        let message;

        switch (settings.rotation) {
            case 'interval':
                message = _('Rotation will occur every %d seconds'.format(settings.interval));
                break;
            case 'hourly':
                message = _('Rotation will occur at the beginning of every hour');
                break;
            default:
                message = _('Rotation has been disabled');
                break;
        }

        notify(message);
    });

    button = new DeskChangerPanelMenuButton(daemon, settings);
    Main.panel.addToStatusArea('DeskChanger', button);
}

function notify(message, force) {
    if (settings.notifications || force === true) {
        Main.notify('DeskChanger', message);
    }
}

function init() {
    log(`init ${Me.uuid} version ${Me.metadata.version}`);
    settings = Convenience.getSettings();
    daemon = new DeskChangerDaemon(settings);
}