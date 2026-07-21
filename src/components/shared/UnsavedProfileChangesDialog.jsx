import { AlertTriangle, Loader2, Save } from 'lucide-react';

import { Button } from '../../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';

export default function UnsavedProfileChangesDialog({
    open,
    onStay,
    onSave,
    isSaving = false,
}) {
    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!nextOpen) {
                onStay();
            }
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                        <AlertTriangle className="size-5" />
                    </div>
                    <DialogTitle>Save profile first</DialogTitle>
                    <DialogDescription>
                        Save your Profile Details before opening another tab.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onStay} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={onSave} disabled={isSaving} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                        {isSaving ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="size-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
