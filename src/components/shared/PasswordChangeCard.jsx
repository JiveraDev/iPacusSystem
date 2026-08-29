import { useState } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { toast } from '../../reusecomponent/toast.jsx';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import PasswordInput from './PasswordInput.jsx';
import PasswordRequirements from './PasswordRequirements.jsx';
import { updateUserPassword } from '../../services/userService';
import { clearStoredAuthSession } from '../../services/apiClient';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '../../lib/passwordPolicy.js';

export default function PasswordChangeCard({ userId, onForgotPassword }) {
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isForgotPasswordDialogOpen, setIsForgotPasswordDialogOpen] = useState(false);

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const clearPasswordFields = () => {
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!userId) {
            toast.error('Session error. Please log in again.');
            clearPasswordFields();
            return;
        }

        if (!isPasswordStrong(form.newPassword)) {
            toast.error(PASSWORD_POLICY_MESSAGE);
            clearPasswordFields();
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            toast.error('New password and confirmation do not match.');
            clearPasswordFields();
            return;
        }

        setIsSaving(true);
        try {
            await updateUserPassword(userId, {
                currentPassword: form.currentPassword,
                newPassword: form.newPassword
            });

            setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            toast.success('Password changed successfully.');
        } catch (error) {
            clearPasswordFields();
            toast.error(error.message || 'Failed to change password.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleForgotPassword = () => {
        setIsForgotPasswordDialogOpen(true);
    };

    const confirmForgotPassword = () => {
        setIsForgotPasswordDialogOpen(false);
        clearPasswordFields();

        if (onForgotPassword) {
            onForgotPassword();
            return;
        }

        clearStoredAuthSession();
        window.history.pushState({}, '', '/landing/forgot-password');
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
        <Card className="border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-800 sm:text-2xl">
                    <KeyRound className="h-5 w-5 text-[#155dfc]" />
                    Change Password
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
                <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword" className="text-sm font-bold text-slate-700">Current Password</Label>
                        <PasswordInput
                            id="currentPassword"
                            value={form.currentPassword}
                            onChange={(event) => updateField('currentPassword', event.target.value)}
                            disabled={isSaving}
                            required
                            inputClassName="h-12 rounded-xl"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-sm font-bold text-slate-700">New Password</Label>
                            <PasswordInput
                                id="newPassword"
                                value={form.newPassword}
                                onChange={(event) => updateField('newPassword', event.target.value)}
                                disabled={isSaving}
                                required
                                minLength={8}
                                inputClassName="h-12 rounded-xl"
                            />
                            <PasswordRequirements password={form.newPassword} confirmPassword={form.confirmPassword} className="mt-2 md:grid-cols-1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm font-bold text-slate-700">Confirm Password</Label>
                            <PasswordInput
                                id="confirmPassword"
                                value={form.confirmPassword}
                                onChange={(event) => updateField('confirmPassword', event.target.value)}
                                disabled={isSaving}
                                required
                                minLength={8}
                                inputClassName="h-12 rounded-xl"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Button type="submit" disabled={isSaving} className="h-12 rounded-xl bg-[#155dfc] px-8 font-bold hover:bg-blue-700">
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update Password'
                            )}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleForgotPassword} disabled={isSaving} className="h-12 rounded-xl px-8 font-bold">
                            Forgot Password
                        </Button>
                    </div>
                </form>
            </CardContent>

            <Dialog open={isForgotPasswordDialogOpen} onOpenChange={setIsForgotPasswordDialogOpen}>
                <DialogContent className="max-w-md" showClose={false}>
                    <DialogHeader>
                        <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                            <LogOut className="size-5" />
                        </div>
                        <DialogTitle>Log out to reset your password?</DialogTitle>
                        <DialogDescription>
                            For account security, password recovery continues outside your signed-in session.
                        </DialogDescription>
                    </DialogHeader>

                    <p className="text-sm leading-6 text-slate-600">
                        You will be logged out and taken to the Forgot Password page. You can return after resetting your password and signing in again.
                    </p>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsForgotPasswordDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={confirmForgotPassword} className="bg-red-600 text-white hover:bg-red-700">
                            <LogOut className="size-4" />
                            Log Out and Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
