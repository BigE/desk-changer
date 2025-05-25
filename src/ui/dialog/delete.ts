import Adw from "gi://Adw";
import GObject from "gi://GObject";

const DeleteDialog = GObject.registerClass(
class DeskChangerUiDialogDelete extends Adw.AlertDialog {
    constructor() {
        super();

        this.add_response('no', 'No');
        this.add_response('yes', 'Yes');
        this.set_default_response('no');
        this.set_close_response('no');
    }
}
);

export default DeleteDialog;
export type DeleteDialogType = InstanceType<typeof DeleteDialog>;
