'use strict';

const Me = imports.misc.extensionUtils.getCurrentExtension();
// first init the common things
Me.imports._deskchanger;

const Utils = Me.imports.common.utils;
const Convenience = Me.imports.convenience;
const Service = Me.imports.service;
const DeskChangerPanelMenuButton = Me.imports.ui.panelMenu.Button;

const Main = imports.ui.main;
const _ = deskchanger._;

    // general
let daemon, button,
    // signals
    changed_id, current_profile_id, notifications_id, random_id, rotation_id;

function disable() {
    deskchanger.debug('disabling extension');

    // This function is run no matter if we're locking the screen or logging
    // out. We save the state here in case the latter is what's happening.
    if (daemon && daemon.Running && deskchanger.settings.remember_profile_state) {
        daemon.desktop_profile.save_state();
    }

    // button go bye bye
    if (button && typeof button.destroy === 'function') {
        button.destroy();
    }
    button = null;

    if (changed_id) {
        daemon.disconnect(changed_id);
    }
    changed_id = null;

    if (current_profile_id) {
        deskchanger.settings.disconnect(current_profile_id);
    }
    current_profile_id = null;

    if (notifications_id) {
        deskchanger.settings.disconnect(notifications_id);
    }
    notifications_id = null;

    if (random_id) {
        deskchanger.settings.disconnect(random_id);
    }
    random_id = null;

    if (rotation_id) {
        deskchanger.settings.disconnect(rotation_id);
    }
    rotation_id = null;
}

function enable() {
    deskchanger.debug('enabling extension');

    if (deskchanger.settings.auto_start && !daemon.Running) {
        daemon.StartSync();
    }

    //changed_id = daemon.connect('changed', function (obj, file) {
    //    notify(_('Wallpaper changed: %s'.format(file)));
    //});

    current_profile_id = deskchanger.settings.connect('changed::current-profile', function () {
        notify(_('Profile changed to %s'.format(deskchanger.settings.current_profile)));
    });

    notifications_id = deskchanger.settings.connect('changed::notifications', function () {
        notify(((deskchanger.settings.notifications) ?
            _('Notifications are now enabled') :
            _('Notifications are now disabled')
        ), true);
    });

    random_id = deskchanger.settings.connect('changed::random', function () {
        notify(((deskchanger.settings.random)?
            _('Wallpapers will be shown in a random order') :
            _('Wallpapers will be shown in the order they were loaded')
        ));
    });

    rotation_id = deskchanger.settings.connect('changed::rotation', function () {
        let message;

        switch (deskchanger.settings.rotation) {
            case 'interval':
                message = _('Rotation will occur every %d seconds'.format(deskchanger.settings.interval));
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

    button = new DeskChangerPanelMenuButton(daemon);
    Main.panel.addToStatusArea('DeskChanger', button);
}

function notify(message, force) {
    if (deskchanger.settings.notifications || force === true) {
        Main.notify('DeskChanger', message);
    }
}

function init() {
    log(`init ${Me.uuid} version ${Me.metadata.version}`);

    Utils.installService();

    daemon = new Service.makeProxyWrapper();
    daemon.init(null);
}