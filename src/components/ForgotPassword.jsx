import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";

import imgImageVfcLogo from "../assets/circular_logo.png";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import PasswordInput from "./shared/PasswordInput.jsx";
import { requestPasswordReset, resetPasswordWithOtp } from "../services/authEmail";
import { toast } from "../reusecomponent/toast.jsx";

export function ForgotPassword({ initialEmail = "", onBack, onComplete }) {
    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [codeRequested, setCodeRequested] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleRequestCode = async (event) => {
        event.preventDefault();

        if (!email) {
            toast.error("Enter your email.");
            return;
        }

        setIsRequesting(true);
        try {
            const data = await requestPasswordReset({ email });
            setCodeRequested(true);
            toast.success(data.message || "If this email exists, a password reset code was sent.");
        } catch (error) {
            toast.error(error.message || "Failed to request reset code.");
        } finally {
            setIsRequesting(false);
        }
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();

        if (!/^\d{6}$/.test(code.trim())) {
            toast.error("Enter the 6-digit code.");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation do not match.");
            return;
        }

        setIsResetting(true);
        try {
            await resetPasswordWithOtp({ email, code: code.trim(), newPassword });
            toast.success("Password changed. You can now log in.");
            onComplete();
        } catch (error) {
            toast.error(error.message || "Failed to reset password.");
            setCode("");
            setNewPassword("");
            setConfirmPassword("");
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
            <div className="w-full max-w-md">
                <div className="mb-6 text-center">
                    <div className="mb-4 flex items-center justify-center gap-3">
                        <img src={imgImageVfcLogo} alt="iPawcus" className="h-14 w-14 object-contain" />
                        <h1 className="text-3xl font-bold text-[#155dfc]">iPawcus</h1>
                    </div>
                    <p className="text-sm font-medium text-slate-600">Reset your password using a code sent to your email.</p>
                </div>

                <Card className="overflow-hidden border-slate-200 shadow-lg">
                    <CardHeader className="border-b border-slate-100 bg-white">
                        <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
                            <ShieldCheck className="h-5 w-5 text-[#155dfc]" />
                            Forgot Password
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                        <form onSubmit={handleRequestCode} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="resetEmail">Email</Label>
                                <Input
                                    id="resetEmail"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="your.email@example.com"
                                    required
                                />
                            </div>
                            <Button type="submit" variant="outline" disabled={isRequesting} className="h-11 w-full">
                                {isRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                {codeRequested ? "Send Code Again" : "Send Reset Code"}
                            </Button>
                        </form>

                        {codeRequested && (
                            <form onSubmit={handleResetPassword} className="mt-5 space-y-4 border-t border-slate-200 pt-5">
                                <div className="space-y-2">
                                    <Label htmlFor="resetCode">6-digit code</Label>
                                    <Input
                                        id="resetCode"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={code}
                                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                        placeholder="000000"
                                        required
                                        className="text-center text-xl font-black tracking-[0.3em]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="newPassword">New password</Label>
                                    <PasswordInput
                                        id="newPassword"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        minLength={8}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmNewPassword">Confirm password</Label>
                                    <PasswordInput
                                        id="confirmNewPassword"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        minLength={8}
                                        required
                                    />
                                </div>
                                <Button type="submit" disabled={isResetting} className="h-11 w-full bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                    {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Change Password
                                </Button>
                            </form>
                        )}

                        <Button type="button" variant="ghost" onClick={onBack} className="mt-4 h-11 w-full">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

ForgotPassword.propTypes = {
    initialEmail: PropTypes.string,
    onBack: PropTypes.func.isRequired,
    onComplete: PropTypes.func.isRequired,
};
