import { useState } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { toast } from '../../reusecomponent/toast.jsx';
import { KeyRound, Loader2 } from 'lucide-react';
import PasswordInput from './PasswordInput.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function PasswordChangeCard({ userId, onForgotPassword }) {
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!userId) {
            toast.error('Session error. Please log in again.');
            return;
        }

        if (form.newPassword.length < 8) {
            toast.error('New password must be at least 8 characters.');
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            toast.error('New password and confirmation do not match.');
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE}/api/users/${userId}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: form.currentPassword,
                    newPassword: form.newPassword
                })
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || 'Failed to change password.');
            }

            setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            toast.success('Password changed successfully.');
        } catch (error) {
            toast.error(error.message || 'Failed to change password.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleForgotPassword = () => {
        toast.success('Please log in again to continue password recovery.');
        localStorage.removeItem('authToken');

        if (onForgotPassword) {
            onForgotPassword();
            return;
        }

        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        window.history.pushState({}, '', '/landing/login');
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
        </Card>
    );
}
