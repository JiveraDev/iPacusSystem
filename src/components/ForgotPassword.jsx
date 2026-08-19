import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, Mail, ShieldCheck } from "lucide-react";

import imgImageVfcLogo from "../assets/circular_logo.png";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import PasswordInput from "./shared/PasswordInput.jsx";
import { requestPasswordReset, resetPasswordWithOtp, verifyPasswordResetCode } from "../services/authEmail";
import { toast } from "../reusecomponent/toast.jsx";

export function ForgotPassword({ initialEmail = "", onBack, onComplete }) {
    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [codeRequested, setCodeRequested] = useState(false);
    const [isCodeVerified, setIsCodeVerified] = useState(false);
    const [codeExpiresAt, setCodeExpiresAt] = useState(0);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [isRequesting, setIsRequesting] = useState(false);
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const resetCodeVerification = () => {
        setCode("");
        setNewPassword("");
        setConfirmPassword("");
        setIsCodeVerified(false);
    };

    useEffect(() => {
        if (!codeRequested || !codeExpiresAt) {
            return undefined;
        }

        const updateCountdown = () => {
            const seconds = Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 1000));
            setRemainingSeconds(seconds);

            if (seconds === 0) {
                setIsCodeVerified(false);
                setNewPassword("");
                setConfirmPassword("");
                return false;
            }

            return true;
        };

        if (!updateCountdown()) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            if (!updateCountdown()) {
                window.clearInterval(intervalId);
            }
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [codeExpiresAt, codeRequested]);

    const formattedTimeRemaining = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

    const handleEmailChange = (event) => {
        setEmail(event.target.value);

        if (codeRequested) {
            setCodeRequested(false);
            setCodeExpiresAt(0);
            setRemainingSeconds(0);
            resetCodeVerification();
        }
    };

    const handleRequestCode = async (event) => {
        event.preventDefault();

        if (!email) {
            toast.error("Enter your email.");
            return;
        }

        setIsRequesting(true);
        try {
            const data = await requestPasswordReset({ email });
            resetCodeVerification();
            const expiresInSeconds = Math.max(60, Number(data.expiresInSeconds) || 600);
            setCodeExpiresAt(Date.now() + (expiresInSeconds * 1000));
            setRemainingSeconds(expiresInSeconds);
            setCodeRequested(true);
            toast.success({
                title: 'Code successfully sent',
                description: data.message || 'If this email exists, a password reset code was sent via email.'
            });
        } catch (error) {
            toast.error(error.message || "Failed to request reset code.");
        } finally {
            setIsRequesting(false);
        }
    };

    const handleVerifyCode = async (event) => {
        event.preventDefault();

        if (!/^\d{6}$/.test(code.trim())) {
            toast.error("Enter the 6-digit code.");
            return;
        }

        setIsVerifyingCode(true);
        try {
            const data = await verifyPasswordResetCode({ email, code: code.trim() });
            setIsCodeVerified(true);
            toast.success(data.message || "Verification code confirmed.");
        } catch (error) {
            setIsCodeVerified(false);
            setNewPassword("");
            setConfirmPassword("");
            toast.error(error.message || "Failed to verify the code.");
        } finally {
            setIsVerifyingCode(false);
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
            resetCodeVerification();
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
                                    onChange={handleEmailChange}
                                    placeholder="your.email@example.com"
                                    disabled={isRequesting || isVerifyingCode || isResetting || isCodeVerified}
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={isRequesting || isVerifyingCode || isResetting || isCodeVerified}
                                className="h-11 w-full"
                            >
                                {isRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                {codeRequested ? "Send Code Again" : "Send Reset Code"}
                            </Button>
                        </form>

                        {codeRequested && (
                            <form
                                onSubmit={isCodeVerified ? handleResetPassword : handleVerifyCode}
                                className="mt-5 space-y-4 border-t border-slate-200 pt-5"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="resetCode">6-digit code</Label>
                                    <Input
                                        id="resetCode"
                                        inputMode="numeric"
                                        restriction="digits"
                                        maxLength={6}
                                        value={code}
                                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                        placeholder="000000"
                                        disabled={isVerifyingCode || isResetting || isCodeVerified || remainingSeconds === 0}
                                        required
                                        className="text-center text-xl font-black tracking-[0.3em]"
                                    />
                                    {isCodeVerified && (
                                        <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                                            <CheckCircle2 className="size-4" />
                                            Code verified
                                        </p>
                                    )}
                                    <p className={`flex items-center gap-2 text-sm font-semibold ${remainingSeconds > 0 ? "text-slate-600" : "text-red-600"}`}>
                                        <Clock3 className="size-4" />
                                        {remainingSeconds > 0
                                            ? `Code expires in ${formattedTimeRemaining}`
                                            : "Code expired. Request a new code."}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="newPassword">New password</Label>
                                    <PasswordInput
                                        id="newPassword"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        minLength={8}
                                        disabled={!isCodeVerified || isResetting}
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
                                        disabled={!isCodeVerified || isResetting}
                                        required
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isVerifyingCode || isResetting || remainingSeconds === 0}
                                    className="h-11 w-full bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                                >
                                    {(isVerifyingCode || isResetting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isCodeVerified ? "Change Password" : "Verify Code"}
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
