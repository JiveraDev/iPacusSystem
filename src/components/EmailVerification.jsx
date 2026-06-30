import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Loader2, MailCheck, RefreshCw } from "lucide-react";

import imgImageVfcLogo from "../assets/circular_logo.png";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { resendVerificationCode, verifyEmail } from "../services/authEmail";
import { toast } from "../reusecomponent/toast.jsx";

export function EmailVerification({ initialEmail = "", onBack, onVerified }) {
    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const handleVerify = async (event) => {
        event.preventDefault();

        if (!email || !/^\d{6}$/.test(code.trim())) {
            toast.error("Enter your email and the 6-digit code.");
            return;
        }

        setIsVerifying(true);
        try {
            await verifyEmail({ email, code: code.trim() });
            toast.success("Email verified. You can now log in.");
            onVerified();
        } catch (error) {
            toast.error(error.message || "Failed to verify email.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            toast.error("Enter your email first.");
            return;
        }

        setIsResending(true);
        try {
            await resendVerificationCode({ email });
            toast.success("Verification code sent.");
        } catch (error) {
            toast.error(error.message || "Failed to resend code.");
        } finally {
            setIsResending(false);
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
                    <p className="text-sm font-medium text-slate-600">Verify your email to activate your account.</p>
                </div>

                <Card className="overflow-hidden border-slate-200 shadow-lg">
                    <CardHeader className="border-b border-slate-100 bg-white">
                        <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
                            <MailCheck className="h-5 w-5 text-[#155dfc]" />
                            Email Verification
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="verificationEmail">Email</Label>
                                <Input
                                    id="verificationEmail"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="your.email@example.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="verificationCode">6-digit code</Label>
                                <Input
                                    id="verificationCode"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={code}
                                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="000000"
                                    required
                                    className="text-center text-xl font-black tracking-[0.3em]"
                                />
                            </div>
                            <Button type="submit" disabled={isVerifying} className="h-11 w-full bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Verify Email
                            </Button>
                        </form>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <Button type="button" variant="outline" onClick={handleResend} disabled={isResending} className="h-11">
                                {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Resend Code
                            </Button>
                            <Button type="button" variant="ghost" onClick={onBack} className="h-11">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Login
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}