import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

export default class DeleteDialog extends Adw.AlertDialog {
    static {
        GObject.registerClass(
            {
                GTypeName: 'DeskChangerUiDeleteDialog',
            },
            this
        );
    }

    constructor(params?: Partial<Adw.AlertDialog.ConstructorProps>) {
        super(params);

        this.add_response('no', 'No');
        this.add_response('yes', 'Yes');
        this.set_default_response('yes');
        this.set_close_response('no');
    }
}
