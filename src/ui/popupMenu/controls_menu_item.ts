import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';

import ControlButton from '../control/button.js';
import ControlStateButton from '../control/state_button.js';
import Clutter from 'gi://Clutter';

export namespace ControlsMenuItem {
    export interface ConstructorProps
        extends PopupMenu.PopupBaseMenuItem.ConstructorProps {
        random: boolean;
        service_running: boolean;
    }
}

/**
 * Control menu item to give control over the service
 *
 * This menu item will provide controls for next, previous, and random that can
 * be used to interact with the service and settings. When the random property
 * is changed the icon will update accordingly and when the random control is
 * clicked, the property will be updated. The next and previous controls both
 * emit their respective next-clicked and previous-clicked signals when the
 * control is clicked.
 */
export default class ControlsMenuItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiPopupMenuControlsMenuItem',
                Properties: {
                    random: GObject.param_spec_boolean(
                        'random',
                        'Random',
                        'Tell the daemon to randomly select the next wallpaper',
                        false,
                        GObject.ParamFlags.READWRITE
                    ),
                    'service-running': GObject.param_spec_boolean(
                        'service-running',
                        'Service Running',
                        'Check if the service is running',
                        false,
                        GObject.ParamFlags.READWRITE
                    ),
                },
                Signals: {
                    'next-clicked': [],
                    'previous-clicked': [],
                },
            },
            this
        );
    }

    #content_box?: St.BoxLayout;
    #next?: ControlButton;
    #next_clicked_id?: number;
    #prev?: ControlButton;
    #prev_clicked_id?: number;
    #random: boolean;
    #random_control?: ControlStateButton;
    #random_clicked_id?: number;
    #service_running: boolean;
    #service_running_binding?: GObject.Binding;
    #service_running_control?: ControlStateButton;

    get random() {
        return this.#random;
    }

    set random(value: boolean) {
        this.#random = value;
        this.#random_control?.set_state(value ? 'random' : 'ordered');
        this.notify('random');
    }

    get service_running() {
        return this.#service_running;
    }

    set service_running(value: boolean) {
        console.log(`controls_menu_item.service_running: ${value}`);
        this.#service_running = value;
        this.notify('service-running');
    }

    constructor(properties?: Partial<ControlsMenuItem.ConstructorProps>) {
        const {random, service_running, ...props} = properties || {};
        props.reactive ??= false;
        super(props);

        this.#content_box = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        this.#random = random || true;
        this.#service_running = service_running || false;
        this.#next = new ControlButton({icon_name: 'media-skip-forward'});
        this.#next_clicked_id = this.#next.connect('clicked', () =>
            this.emit('next-clicked')
        );
        this.#prev = new ControlButton({icon_name: 'media-skip-backward'});
        this.#prev_clicked_id = this.#prev.connect('clicked', () =>
            this.emit('previous-clicked')
        );
        this.#random_control = new ControlStateButton(
            {
                random: 'media-playlist-shuffle',
                ordered: 'media-playlist-repeat',
            },
            this.#random ? 'random' : 'ordered'
        );
        this.#random_clicked_id = this.#random_control.connect(
            'notify::state',
            () => {
                this.random = this.#random_control?.state === 'random';
            }
        );

        this.#service_running_control = new ControlStateButton({
            running: 'media-playback-stop',
            stopped: 'media-playback-start',
        }, this.service_running ? 'running' : 'stopped');

        // @ts-expect-error - The TS bindings are wrong https://github.com/gjsify/ts-for-gir/issues/154
        this.#service_running_binding = this.bind_property_full(
            'service_running',
            this.#service_running_control, 'state',
            GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
            (binding, source) => {
                console.log(`binding_to: ${source}`);
                return [true, source === true? 'running' : 'stopped'];
            },
            (binding, source) => {
                console.log(`binding_from: ${source}`);
                return [true, source === 'running'];
            }
        );

        this.#content_box.add_child(this.#prev);
        this.#content_box.add_child(new St.Bin({x_expand: true}));
        this.#content_box.add_child(this.#random_control);
        this.#content_box.add_child(new St.Bin({x_expand: true}));
        this.#content_box.add_child(this.#service_running_control);
        this.#content_box.add_child(new St.Bin({x_expand: true}));
        this.#content_box.add_child(this.#next);
        this.add_child(new St.Bin({x_expand: true}));
        this.add_child(this.#content_box);
        this.add_child(new St.Bin({x_expand: true}));
    }

    destroy() {
        if (this.#next_clicked_id) {
            this.#next!.disconnect(this.#next_clicked_id);
            this.#next_clicked_id = undefined;
        }

        if (this.#prev_clicked_id) {
            this.#prev!.disconnect(this.#prev_clicked_id);
            this.#prev_clicked_id = undefined;
        }

        if (this.#random_clicked_id) {
            this.#random_control!.disconnect(this.#random_clicked_id);
            this.#random_clicked_id = undefined;
        }

        this.#service_running_binding?.unbind();
        this.#service_running_binding = undefined;
        this.#next?.destroy();
        this.#next = undefined;
        this.#prev?.destroy();
        this.#prev = undefined;
        this.#random_control?.destroy();
        this.#random_control = undefined;
        this.#content_box?.destroy();
        this.#content_box = undefined;
        super.destroy();
    }
}
