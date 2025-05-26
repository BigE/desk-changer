import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import Service from "../../service/index.js";
import ControlButton from "../control/button.js";
import ControlStateButton from "../control/state_button.js";

export default class ControlsMenuItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPopupMenuControlsMenuItem",
        }, this);
    }

    #next?: ControlButton;
    #next_clicked_id?: number;
    #prev?: ControlButton;
    #prev_clicked_id?: number;
    #random?: ControlStateButton;
    #random_changed_id?: number;
    #random_clicked_id?: number;
    #service?: Service;
    #settings?: Gio.Settings;

    constructor(service: Service, settings: Gio.Settings) {
        super();

        this.#service = service;
        this.#settings = settings;
        this.#next = new ControlButton('media-skip-forward');
        this.#next_clicked_id = this.#next.connect('clicked', () => {
            this.#service?.Next();
        });
        this.#prev = new ControlButton('media-skip-backward');
        this.#prev_clicked_id = this.#prev.connect('clicked', () => {
            this.#service?.Previous();
        });
        this.#random = new ControlStateButton([
            {
                icon: 'media-playlist-shuffle',
                name: 'random',
            },
            {
                icon: 'media-playlist-repeat',
                name: 'ordered',
            },
        ]);
        this.#random.set_state(settings.get_boolean('random')? 'random' : 'ordered');
        this.#random_clicked_id = this.#random.connect('clicked', (state) => {
            this.#settings?.set_boolean('random', (state.name === 'random'));
        });
        this.#random_changed_id = this.#settings?.connect('changed::random', () => {
            this.#random?.set_state((this.#settings?.get_boolean('random')? 'random' : 'ordered'));
        });

        this.add_child(this.#prev);
        this.add_child(this.#random);
        this.add_child(this.#next);
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

        if (this.#random_changed_id) {
            this.#settings!.disconnect(this.#random_changed_id);
            this.#random_changed_id = undefined;
        }

        if (this.#random_clicked_id) {
            this.#random!.disconnect(this.#random_clicked_id);
            this.#random_clicked_id = undefined;
        }

        this.#next?.destroy();
        this.#next = undefined;
        this.#prev?.destroy()
        this.#prev = undefined;
        this.#random?.destroy();
        this.#random = undefined;
        this.#service = undefined;
        this.#settings = undefined;
        super.destroy();
    }
}
