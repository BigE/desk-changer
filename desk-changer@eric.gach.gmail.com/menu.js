/**
 * Copyright (c) 2014-2017 Eric Gach <eric.gach@gmail.com>
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

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;

const DeskChangerSettings = Me.imports.settings.DeskChangerSettings;
const debug = Me.imports.utils.debug;
const Ui = Me.imports.ui;

const DeskChangerControls = new Lang.Class({
    Name: 'DeskChangerControls',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (dbus, settings) {
        this._dbus = dbus;
        this._settings = settings;
        this._bindings = [];
        this.parent({can_focus: false, reactive: false});

        this._addKeyBinding('next-wallpaper', Lang.bind(this, this.next));
        this._addKeyBinding('prev-wallpaper', Lang.bind(this, this.prev));

        this._next = new Ui.DeskChangerButton('media-skip-forward', Lang.bind(this, this.next));
        this._prev = new Ui.DeskChangerButton('media-skip-backward', Lang.bind(this, this.prev));
        this._random = new Ui.DeskChangerStateButton([
            {
                icon: 'media-playlist-shuffle',
                name: 'random'
            },
            {
                icon: 'media-playlist-repeat',
                name: 'ordered'
            }
        ], Lang.bind(this, this._toggle_random));
        this._random.set_state((this._settings.random) ? 'random' : 'ordered');
        this._timer = new Ui.DeskChangerStateButton([
            {
                icon: 'media-playback-stop',
                name: 'enable'
            },
            {
                icon: 'media-playback-start',
                name: 'disable'
            }
        ], Lang.bind(this, this._toggle_timer));
        this._timer.set_state((this._settings.timer_enabled) ? 'enable' : 'disable');

        if (this.addActor) {
            this._box = new St.BoxLayout({style: 'spacing: 20px;'});
            this.addActor(this._box, {align: St.Align.MIDDLE, span: -1});
            this._box.add_actor(this._prev, {expand: true});
            this._box.add_actor(this._random, {expand: true});
            this._box.add_actor(this._timer, {expand: true});
            this._box.add_actor(this._next, {expand: true});
        } else {
            this.actor.add_actor(this._prev, {expand: true, x_fill: false});
            this.actor.add_actor(this._random, {expand: true, x_fill: false});
            this.actor.add_actor(this._timer, {expand: true, x_fill: false});
            this.actor.add_actor(this._next, {expand: true, x_fill: false});
        }
    },

    destroy: function () {
        let size = this._bindings.length;

        for (let i = 0; i < size; i++) {
            this._removeKeyBinding(this._bindings[i]);
        }

        this._next.destroy();
        this._prev.destroy();
        this._random.destroy();
        this._timer.destroy();
        this.parent();
    },

    next: function () {
        debug('next');
        this._dbus.NextSync();
    },

    prev: function() {
        debug('prev');
        this._dbus.PrevRemote(function (result) {
            if (result[0].length == 0) {
                Main.notifyError('Desk Changer', 'Unable to go back any further, no history available');
            }
        });
    },

    _addKeyBinding: function (key, handler) {
        let success = false;
        if (Shell.ActionMode) { // 3.16 and above
            success = Main.wm.addKeybinding(
                key,
                this._settings.schema,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL,
                handler
            );
        } else { // 3.8 and above
            success = Main.wm.addKeybinding(
                key,
                this._settings.schema,
                Meta.KeyBindingFlags.NONE,
                Shell.KeyBindingMode.NORMAL,
                handler
            );
        }

        this._bindings.push(key);
        if (success) {
            debug('added keybinding ' + key);
        } else {
            debug('failed to add keybinding ' + key);
            debug(success);
        }
    },

    _removeKeyBinding: function (key) {
        if (this._bindings.indexOf(key)) {
            this._bindings.splice(this._bindings.indexOf(key), 1);
        }

        debug('removing keybinding ' + key);
        Main.wm.removeKeybinding(key);
    },

    _toggle_random: function (state) {
        debug('setting order to ' + state);
        this._settings.random = (state == 'random');
    },

    _toggle_timer: function (state) {
        debug(state + 'ing timer');
        this._settings.timer_enabled = (state == 'enable');
    }
});

const DeskChangerDaemonControls = new Lang.Class({
    Name: 'DeskChangerDaemonControls',
    Extends: PopupMenu.PopupSwitchMenuItem,

    _init: function (daemon) {
        this.parent('DeskChanger Daemon');
        this.daemon = daemon;
        this.setToggleState(this.daemon.is_running);
        this._handler = this.connect('toggled', Lang.bind(this, function () {
            this.daemon.toggle();
        }));
        this._daemon_handler = this.daemon.connect('toggled', Lang.bind(this, function (obj, state) {
            this.setToggleState(state);
        }));
    },

    destroy: function () {
        // not sure why, but removing this handler causes the extension to crash on unload... meh
        //debug('removing daemon switch handler '+this._handler);
        //this.disconnect(this._handler);
        debug('removing daemon toggled handler ' + this._daemon_handler);
        this.daemon.disconnect(this._daemon_handler);
        this.daemon.destroy();
        this.parent();
    }
});

const DeskChangerOpenCurrent = new Lang.Class({
    Name: 'DeskChangerOpenCurrent',
    Extends: PopupMenu.PopupMenuItem,

    _init: function () {
        this._background = new Gio.Settings({'schema': 'org.gnome.desktop.background'});
        this.parent('Open Current Wallpaper');
        this._activate_id = this.connect('activate', Lang.bind(this, this._activate));
    },

    destroy: function () {
        debug('removing current activate handler ' + this._activate_id);
        this.disconnect(this._activate_id);
        this.parent();
    },

    _activate: function () {
        debug('opening current wallpaper ' + this._background.get_string('picture-uri'));
        Util.spawn(['xdg-open', this._background.get_string('picture-uri')]);
    }
});

const DeskChangerPreviewMenuItem = new Lang.Class({
    Name: 'DeskChangerPreviewMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (daemon) {
        this.parent({reactive: true});
        this._box = new St.BoxLayout({vertical: true});
        try {
            this.addActor(this._box, {align: St.Align.MIDDLE, span: -1});
        } catch (e) {
            this.actor.add_actor(this._box, {align: St.Align.MIDDLE, span: -1});
        }
        this._label = new St.Label({text: "Open Next Wallpaper"});
        this._box.add(this._label);
        this._preview = new Ui.DeskChangerPreview(220, daemon);
        this._box.add(this._preview);
        this._activate_id = this.connect('activate', Lang.bind(this, this._clicked));
    },

    destroy: function () {
        debug('removing preview activate handler ' + this._activate_id);
        this.disconnect(this._activate_id);

        this._preview.destroy();
        this._label.destroy();
        this._box.destroy();
        this.parent();
    },

    _clicked: function () {
        if (this._preview.file) {
            debug('opening file ' + this._preview.file);
            Util.spawn(['xdg-open', this._preview.file]);
        } else {
            debug('ERROR: no preview currently set');
        }
    }
});

const DeskChangerProfile = new Lang.Class({
    Name: 'DeskChangerProfile',
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function (settings, sensitive = true) {
        this._settings = settings;
        this.parent('Profile: ' + this._settings.current_profile);
        this._populate_profiles();
        this._settings.connect('changed::current-profile', Lang.bind(this, this.setLabel));
        this._settings.connect('changed::profiles', Lang.bind(this, this._populate_profiles))
        this.setSensitive(sensitive);
    },

    setLabel: function () {
        this.label.text = 'Profile: ' + this._settings.current_profile;
    },

    _populate_profiles: function () {
        this.menu.removeAll();
        for (let index in this._settings.profiles) {
            debug('adding menu: ' + index);
            let item = new PopupMenu.PopupMenuItem(index);
            item.connect('activate', Lang.bind(item, function () {
                let settings = new DeskChangerSettings();
                settings.current_profile = this.label.text;
                settings.destroy();
            }));
            this.menu.addMenuItem(item);
        }
    }
});

const DeskChangerSwitch = new Lang.Class({
    Name: 'DeskChangerSwitch',
    Extends: PopupMenu.PopupSwitchMenuItem,

    _init: function (label, setting, settings) {
        this._setting = setting;
        this._settings = settings;
        this.parent(label);
        this.setToggleState(this._settings[setting]);
        this._handler_changed = this._settings.connect('changed::' + this._setting, Lang.bind(this, this._changed));
        this._handler_toggled = this.connect('toggled', Lang.bind(this, this._toggled));
    },

    destroy: function () {
        if (this._handler_changed) {
            debug('removing changed::' + this._setting + ' handler ' + this._handler_changed);
            this._settings.disconnect(this._handler_changed);
        }

        debug('removing swtich toggled handler ' + this._handler_toggled);
        this.disconnect(this._handler_toggled);
    },

    _changed: function (settings, key) {
        this.setToggleState(this._settings[key]);
    },

    _toggled: function () {
        debug('setting ' + this._setting + ' to ' + this.state);
        this._settings[this._setting] = this.state;
    }
});
