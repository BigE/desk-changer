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
const Convenience = Me.imports.convenience;
const Gettext = imports.gettext.domain(Me.metadata.uuid);
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;
const _ = Gettext.gettext;

const DeskChangerProfileError = Me.imports.profile.DeskChangerProfileError;
const debug = Me.imports.utils.debug;
const error = Me.imports.utils.error;
const Ui = Me.imports.ui;

var DeskChangerControls = new Lang.Class({
    Name: 'DeskChangerControls',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (daemon, settings) {
        this._daemon = daemon;
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

        if (this.addActor) {
            this._box = new St.BoxLayout({style: 'spacing: 20px;'});
            this.addActor(this._box, {align: St.Align.MIDDLE, span: -1});
            this._box.add_actor(this._prev, {expand: true});
            this._box.add_actor(this._random, {expand: true});
            this._box.add_actor(this._next, {expand: true});
        } else {
            this.actor.add(this._prev, {expand: true, x_fill: false});
            this.actor.add(this._random, {expand: true, x_fill: false});
            this.actor.add(this._next, {expand: true, x_fill: false});
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
        this.parent();
    },

    next: function () {
        debug('next');
        this._daemon.next();
    },

    prev: function() {
        debug('prev');
        try {
            this._daemon.prev();
        } catch (e) {
            if (e instanceof DeskChangerProfileError) {
                Main.notifyError('DeskChanger', e.message);
            } else {
                Main.notifyError('DeskChanger', '%s'.format(e));
            }
        }
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
        this._settings.random = (state === 'random');
    },
});

var DeskChangerDaemonControls = new Lang.Class({
    Name: 'DeskChangerDaemonControls',
    Extends: PopupMenu.PopupSwitchMenuItem,

    _init: function (daemon) {
        // Switch label
        this.parent(_('DeskChanger Daemon'));
        this.daemon = daemon;
        this.setToggleState(this.daemon.running);
        this._handler = this.connect('toggled', Lang.bind(this, function () {
            try {
                (this.daemon.running) ? this.daemon.stop() : this.daemon.start();
            } catch (e) {
                if (e instanceof DeskChangerProfileError) {
                    Main.notifyError('DeskChanger', e.message);
                } else {
                    Main.notifyError('DeskChanger', _('failed to start daemon: %s'.format(e)));
                }
            }

            this.setToggleState(this.daemon.running);
        }));
        this._daemon_handler = this.daemon.connect('running', Lang.bind(this, function (obj, state) {
            this.setToggleState(state);
        }));
    },

    destroy: function () {
        // not sure why, but removing this handler causes the extension to crash on unload... meh
        //debug('removing daemon switch handler '+this._handler);
        //this.disconnect(this._handler);
        debug('removing daemon toggled handler ' + this._daemon_handler);
        this.daemon.disconnect(this._daemon_handler);
        this.parent();
    }
});

var DeskChangerOpenCurrent = new Lang.Class({
    Name: 'DeskChangerOpenCurrent',
    Extends: PopupMenu.PopupMenuItem,

    _init: function () {
        this._background = Convenience.getSettings('org.gnome.desktop.background');
        // Menu item label
        this.parent(_('Open Current Wallpaper'));
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

var DeskChangerPreviewMenuItem = new Lang.Class({
    Name: 'DeskChangerPreviewMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (daemon) {
        this.parent({reactive: true});
        this._box = new St.BoxLayout({vertical: true});
        try {
            this.addActor(this._box, {align: St.Align.MIDDLE, span: -1});
        } catch (e) {
            this.actor.add_actor(this._box);
        }
        this._prefix = new St.Label({text: _('Open Next Wallpaper')});
        this._box.add(this._prefix);
        this._preview = new Ui.DeskChangerPreview(220, daemon);
        this._box.add(this._preview);
        this._activate_id = this.connect('activate', Lang.bind(this, this._clicked));
    },

    destroy: function () {
        debug('removing preview activate handler ' + this._activate_id);
        this.disconnect(this._activate_id);

        this._preview.destroy();
        this._prefix.destroy();
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

var DeskChangerPopupSubMenuMenuItem = new Lang.Class({
    Abstract: true,
    Name: 'DeskChangerPopupSubMenuItem',
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function (prefix, key, settings, sensitive = true) {
        this._key = key;
        this._key_normalized = key.replace('_', '-');
        this._prefix = prefix;
        this._settings = settings;
        this.parent('');
        this._settings.connect('changed::'+this._key_normalized, Lang.bind(this, this.setLabel));
        this.setLabel();
        this.setSensitive(sensitive);
    },

    setLabel: function () {
        this.label.text = this._prefix + ': ' + this._settings[this._key];
    }
});

var DeskChangerPopupMenuItem = new Lang.Class({
    Name: 'DeskChangerPopupMenuItem',
    Extends: PopupMenu.PopupMenuItem,

    _init: function (label, value, settings, key) {
        this.parent(label);
        this._value = value;
        this._settings = settings;
        this._key = key;
        this._settingKey = key.replace('_', '-');

        if (this._settings[this._key] === this._value) {
            this.setOrnament(PopupMenu.Ornament.DOT);
        }

        this._handler_key_changed = this._settings.connect('changed::'+this._settingKey, Lang.bind(this, function () {
            if (this._settings[this._key] === this._value) {
                this.setOrnament(PopupMenu.Ornament.DOT);
            } else {
                this.setOrnament(PopupMenu.Ornament.NONE);
            }
        }));
        this._handler_id = this.connect('activate', Lang.bind(this, function () {
            this._settings[this._key] = this._value;
        }));
    },

    destroy: function () {
        this._settings.disconnect(this._handler_key_changed);
        this.disconnect(this._handler_id);
        this.parent();
    }
});

var DeskChangerProfileBase = new Lang.Class({
    Abstract: true,
    Name: 'DeskChangerProfileBase',
    Extends: DeskChangerPopupSubMenuMenuItem,

    _init: function (label, key, settings, sensitive = true) {
        this.parent(label, key, settings, sensitive);
        this._populate_profiles();
        this._settings.connect('changed::profiles', Lang.bind(this, this._populate_profiles));
    },

    _populate_profiles: function () {
        this.menu.removeAll();
        for (let index in this._settings.profiles) {
            debug('adding menu: ' + index);
            let item = new DeskChangerPopupMenuItem(index, index, this._settings, this._key);
            this.menu.addMenuItem(item);
        }
    }
});

var DeskChangerProfileDesktop = new Lang.Class({
    Name: 'DeskChangerProfileDesktop',
    Extends: DeskChangerProfileBase,

    _init: function(settings, sensitive=true) {
        this.parent(_('Desktop Profile'), 'current_profile', settings, sensitive);
    },
});

var DeskChangerProfileLockscreen = new Lang.Class({
    Name: 'DeskChangerProfileLockscreen',
    Extends: DeskChangerProfileBase,

    _init: function(settings, sensitive=true) {
        this.parent(_('Lock Screen Profile'), 'lockscreen_profile', settings, sensitive);
    },

    setLabel: function () {
        let value = this._settings[this._key];

        if (value === '' || value === this._settings.current_profile) {
            value = _('(inherited)');
        }

        this.label.text = _('Lock Screen Profile') + ': ' + value;
    },

    _populate_profiles: function () {
        this.parent();
        let inherit = new DeskChangerPopupMenuItem(_('(inherit from desktop)'), '', this._settings, this._key);
        this.menu.addMenuItem(inherit);
    }
});

var DeskChangerRotation = new Lang.Class({
    Name: 'DeskChangerRotation',
    Extends: DeskChangerPopupSubMenuMenuItem,

    _init: function (settings, sensitive) {
        this.parent(_('Rotation Mode'), 'rotation', settings, sensitive);
        this.menu.addMenuItem(new DeskChangerPopupMenuItem('Interval Timer', 'interval', settings, 'rotation'));
        this.menu.addMenuItem(new DeskChangerPopupMenuItem('Beginning of Hour', 'hourly', settings, 'rotation'));
        this.menu.addMenuItem(new DeskChangerPopupMenuItem('Disabled', 'disabled', settings, 'rotation'));
    }
});

var DeskChangerSwitch = new Lang.Class({
    Name: 'DeskChangerSwitch',
    Extends: PopupMenu.PopupSwitchMenuItem,

    _init: function (label, setting, settings) {
        this._setting = setting;
        this._settings = settings;
        this.parent(label);
        this.setToggleState(this._settings[setting]);
        this._handler_changed = this._settings.connect('changed::' + this._setting.replace(new RegExp('[_]+', 'g'), '-'), Lang.bind(this, this._changed));
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
        this.setToggleState(this._settings[this._setting]);
    },

    _toggled: function () {
        debug('setting ' + this._setting + ' to ' + this.state);
        this._settings[this._setting] = this.state;
    }
});
