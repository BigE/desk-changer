/**
 * Copyright (c) 2014-2015 Eric Gach <eric@php-oop.net>
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

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Meta = imports.gi.Meta;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;

const DeskChangerDaemon = Me.imports.daemon.DeskChangerDaemon;
const DeskChangerSettings = Me.imports.settings.DeskChangerSettings;
const DeskChangerVersion = Me.metadata.version;
const debug = Me.imports.utils.debug;

const DeskChangerButton = new Lang.Class({
    Name: 'DeskChangerButton',
    Extends: St.Button,

    _init: function (icon, callback) {
        this.icon = new St.Icon({icon_name: icon + '-symbolic', icon_size: 20});
        this.parent({
            child: this.icon,
            style_class: 'system-menu-action'// : 'notification-icon-button control-button'
        });
        this._handler = this.connect('clicked', callback);
    },

    destroy: function () {
        debug('removing button clicked handler ' + this._handler);
        this.disconnect(this._handler);
        this.icon.destroy();
        this.parent();
    },

    set_icon: function (icon) {
        this.icon.icon_name = icon + '-symbolic';
    }
});

const DeskChangerControls = new Lang.Class({
    Name: 'DeskChangerControls',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (dbus, settings) {
        this._dbus = dbus;
        this._settings = settings;
        this._bindings = new Array();
        this.parent({can_focus: false, reactive: false});

        this._addKeyBinding('next-wallpaper', Lang.bind(this, this.next));
        this._addKeyBinding('prev-wallpaper', Lang.bind(this._dbus, function () {
            this.prevSync();
        }));

        this._next = new DeskChangerButton('media-skip-forward', Lang.bind(this, this.next));
        this._prev = new DeskChangerButton('media-skip-backward', Lang.bind(this._dbus, function () {
            this.prevSync();
        }));
        this._random = new DeskChangerStateButton([
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
        this._timer = new DeskChangerStateButton([
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
        this._dbus.nextSync(true);
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

    _init: function () {
        this._daemon = new DeskChangerDaemon();
        this.parent('DeskChanger Daemon');
        this.setToggleState(this._daemon.is_running);
        this._handler = this.connect('toggled', Lang.bind(this, function () {
            this._daemon.toggle();
        }));
        this._daemon_handler = this._daemon.connect('toggled', Lang.bind(this, function (obj, state, pid) {
            this.setToggleState(state);
        }));
    },

    destroy: function () {
        // not sure why, but removing this handler causes the extension to crash on unload... meh
        //debug('removing daemon switch handler '+this._handler);
        //this.disconnect(this._handler);
        debug('removing daemon toggled handler ' + this._daemon_handler);
        this.disconnect(this._daemon_handler);
        this._daemon.destroy();
        this.parent();
    }
});

const DeskChangerDBusInterface = '<node>\
	<interface name="org.gnome.shell.extensions.desk_changer">\
		<method name="next">\
			<arg direction="in" name="history" type="b" />\
		</method>\
		<method name="prev">\
		</method>\
		<method name="up_next">\
			<arg direction="out" name="next_file" type="s" />\
		</method>\
		<signal name="changed">\
			<arg direction="out" name="file" type="s" />\
		</signal>\
		<signal name="next_file">\
			<arg direction="out" name="file" type="s" />\
		</signal>\
	</interface>\
</node>';

const DeskChangerDBusProxy = Gio.DBusProxy.makeProxyWrapper(DeskChangerDBusInterface);

const DeskChangerIcon = new Lang.Class({
    Name: 'DeskChangerIcon',
    Extends: St.Bin,

    _init: function (_dbus) {
        this.parent({style_class: 'panel-status-menu-box'});
        // fallback when the daemon is not running
        this._icon = new St.Icon({
            icon_name: 'emblem-photos-symbolic',
            style_class: 'system-status-icon'
        });
        // the preview can be shown as the icon instead
        //this._preview = new DeskChangerPreview(34, _dbus, Lang.bind(this, this.update_child));
        //if (this._preview.file) {
        //    this.set_child(this._preview);
        //} else {
            this.set_child(this._icon);
        //}
    },
    
    destroy: function () {
        this._icon.destroy();
        //this._preview.destroy();
        this.parent();
    },
    
    update_child: function (file) {
        debug('updating icon to preview');
        this.set_child(this._preview);
    }
});

/**
 * This is the actual indicator that should be added to the main panel.
 *
 * @type {Lang.Class}
 */
const DeskChangerIndicator = new Lang.Class({
    Name: 'DeskChangerIndicator',
    Extends: PanelMenu.Button,

    _init: function () {
        this.settings = new DeskChangerSettings();
        this.settings.connect('changed::current-profile', Lang.bind(this, function () {
            if (this.settings.notifications)
                Main.notify('Desk Changer', 'Profile changed to ' + this.settings.current_profile);
        }));
        this.settings.connect('changed::notifications', Lang.bind(this, function () {
            Main.notify('Desk Changer', 'Notifications are now ' + ((this.settings.notifications) ? 'enabled' : 'disabled'));
        }));
        this.parent(0.0, 'DeskChanger');
        this._dbus = new DeskChangerDBusProxy(Gio.DBus.session, 'org.gnome.shell.extensions.desk_changer', '/org/gnome/shell/extensions/desk_changer');
        this._dbus_handler = this._dbus.connectSignal('changed', Lang.bind(this, function (emitter, signalName, parameters) {
            if (this.settings.notifications)
                Main.notify('Desk Changer', 'Wallpaper Changed: ' + parameters[0]);
        }));
        this.actor.add_child(new DeskChangerIcon(this._dbus));
        this.menu.addMenuItem(new DeskChangerProfile(this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerSwitch('Change with Profile', 'auto_rotate', this.settings));
        this.menu.addMenuItem(new DeskChangerSwitch('Notifications', 'notifications', this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerPreviewMenuItem(this._dbus));
        this.menu.addMenuItem(new DeskChangerOpenCurrent());
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerControls(this._dbus, this.settings));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new DeskChangerDaemonControls());
        // Simple settings for the extension
        var settings = new PopupMenu.PopupMenuItem('DeskChanger Settings');
        settings.connect('activate', function () {
            Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
        });
        this.menu.addMenuItem(settings);
    },

    destroy: function () {
        debug('removing dbus changed handler ' + this._dbus_handler);
        this._dbus.disconnectSignal(this._dbus_handler);
        this.settings.destroy();
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

const DeskChangerPreview = new Lang.Class({
    Name: 'DeskChangerPreview',
    Extends: St.Bin,
    
    _init: function (width, _dbus, callback) {
        this.parent({});
        this._file = null;
        this._callback = callback;
        this._dbus = _dbus;
        this._texture = new Clutter.Texture({
            filter_quality: Clutter.TextureQuality.HIGH,
            keep_aspect_ratio: true,
            width: width
        });
        this.set_child(this._texture);
        this._next_file_id = this._dbus.connectSignal('next_file', Lang.bind(this, function (emitter, signalName, parameters) {
            var file = parameters[0];
            this.set_wallpaper(file);
        }));
        this._dbus.up_nextRemote(Lang.bind(this, function (result, e) {
            if (result)
                this.set_wallpaper(result[0]);
        }));
    },
    
    destroy: function () {
        debug('removing dbus next_file handler ' + this._next_file_id);
        this._dbus.disconnectSignal(this._next_file_id);
    },

    set_wallpaper: function (file) {
        this._file = file;
        file = file.replace('file://', '');
        debug('setting preview to ' + file);
        if (this._texture.set_from_file(file) === false) {
            debug('ERROR: Failed to set preview of ' + file);
        } else if (this._callback && typeof this._callback == 'function') {
            this._callback(file);
        }
    },
    
    get file() {
        return this._file;
    }
});

const DeskChangerPreviewMenuItem = new Lang.Class({
    Name: 'DeskChangerPreviewMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (_dbus) {
        this.parent({reactive: true});
        this._box = new St.BoxLayout({vertical: true});
        try {
            this.addActor(this._box, {align: St.Align.MIDDLE, span: -1});
        } catch (e) {
            this.actor.add_actor(this._box, {align: St.Align.MIDDLE, span: -1});
        }
        this._label = new St.Label({text: "Open Next Wallpaper"});
        this._box.add(this._label);
        this._preview = new DeskChangerPreview(220, _dbus);
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

    _init: function (settings) {
        this._settings = settings;
        this.parent('Profile: ' + this._settings.current_profile);
        this._populate_profiles();
        this._settings.connect('changed::current-profile', Lang.bind(this, this.setLabel));
        this._settings.connect('changed::profiles', Lang.bind(this, this._populate_profiles))
    },

    setLabel: function () {
        this.label.text = 'Profile: ' + this._settings.current_profile;
    },

    _populate_profiles: function () {
        this.menu.removeAll();
        for (var index in this._settings.profiles) {
            debug('adding menu: ' + index);
            var item = new PopupMenu.PopupMenuItem(index);
            item.connect('activate', Lang.bind(item, function () {
                var settings = new DeskChangerSettings();
                settings.current_profile = this.label.text;
            }));
            this.menu.addMenuItem(item);
        }
    }
});


const DeskChangerStateButton = new Lang.Class({
    Name: 'DeskChangerStateButton',
    Extends: DeskChangerButton,

    _init: function (states, callback) {
        if (states.length < 2) {
            RangeError('You must provide at least two states for the button');
        }

        this._callback = callback;
        this._states = states;
        this._state = 0;
        this.parent(this._states[0].icon, Lang.bind(this, this._clicked));
    },

    set_state: function (state) {
        if (state == this._states[this._state].name) {
            // We are alread on that state... dafuq?!
            return;
        }

        for (var i = 0; i < this._states.length; i++) {
            if (this._states[i].name == state) {
                this.set_icon(this._states[i].icon);
                this._state = i;
                break;
            }
        }
    },

    _clicked: function () {
        var state = this._state;
        if (++state >= this._states.length)
            state = 0;
        state = this._states[state].name;
        this.set_state(state);
        this._callback(state);
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

function disable() {
    debug('disabling extension');
    if (Main.panel.statusArea.deskchanger) {
        Main.panel.statusArea.deskchanger.destroy();
    }
}

function enable() {
    debug('enabling extension');
    Main.panel.addToStatusArea('deskchanger', new DeskChangerIndicator());
}

function init() {
    debug('initalizing extension version: ' + DeskChangerVersion);
}
