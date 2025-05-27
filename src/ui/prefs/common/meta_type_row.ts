import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

export default class MetaTypeRow extends Adw.ActionRow {
    static {
        GObject.registerClass({
            GTypeName: "DeskChangerUiPrefsCommonMetaTypeRow",
        }, this);
    }

    #delete_button?: Gtk.Button;
    #delete_clicked_id?: number;

    vfunc_realize() {
        super.vfunc_realize();

        const box = (this.get_child() as Gtk.Box) || null;

        if (!box)
            return;

        this.#delete_button = new Gtk.Button({icon_name: "user-trash-symbolic"});
        this.#delete_clicked_id = this.#delete_button.connect('clicked', this.#on_delete_button_clicked.bind(this));
        box.append(this.#delete_button);
    }

    vfunc_unrealize() {
        super.vfunc_unrealize();

        if (this.#delete_clicked_id) {
            this.#delete_button!.disconnect(this.#delete_clicked_id);
            this.#delete_clicked_id = undefined;
        }

        this.#delete_button = undefined;
    }

    #on_delete_button_clicked(): void {
        const mime_type = this.get_title();
        const dialog = new Adw.AlertDialog({body: `Are you sure you want to remove the MIME type <b>${mime_type}<b>?`, body_use_markup: true});

        dialog.choose(this.get_root(), null, (widget, response) => {
            const result = widget?.choose_finish(response);

            console.log(result);
        });
    }
}
