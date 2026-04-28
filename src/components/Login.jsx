import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import imgImageVfcLogo from "../assets/circular_logo.png";
import { loginUser } from "../services/userLogin";
import { toast } from "../reusecomponent/toast.jsx";

export function Login({ onLogin, onBack, onRegister, embedded = false }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setErrorMessage("");

        try {
            const { user, token } = await loginUser({ email, password });
            localStorage.setItem("currentUser", JSON.stringify(user));
            localStorage.setItem("authToken", token);
            toast.success(`Welcome back, ${user.first_Name || 'User'}!`);
            onLogin(user);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Login failed.";
            setErrorMessage(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const content = (
        <div className="w-full max-w-md">
            <div className="text-center mb-3">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <img src={imgImageVfcLogo} alt="iPawcus Logo" className="w-14 h-14 object-contain" />
                    <h1 className="font-bold text-3xl text-[#155dfc]" style={{ fontFamily: "Montserrat, sans-serif" }}>
                        iPawcus
                    </h1>
                </div>
                <p className="text-[#4a5565] mt-2" style={{ fontFamily: "Arimo, sans-serif" }}>
                    Please login to your account.
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.1)] overflow-hidden">
                <div className="pt-6 px-6">
                    <h2
                        className="font-bold text-3xl text-[#155dfc] mb-2 uppercase text-center"
                        style={{ fontFamily: "Montserrat, sans-serif" }}
                    >
                        Login
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 space-y-4">
                    <div className="space-y-2">
                        <label aria-autocomplete={"list"} className="block text-base text-[#0a0a0a]" style={{ fontFamily: "Arimo, sans-serif" }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="w-full bg-[#f3f3f5] border-0 rounded-lg px-3 py-2 text-base text-[#0a0a0a] placeholder:text-[#717182] focus:ring-2 focus:ring-[#155dfc] outline-none"
                            placeholder="your.email@gmail.com"
                            style={{ fontFamily: "Arimo, sans-serif" }}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-base text-[#0a0a0a]" style={{ fontFamily: "Arimo, sans-serif" }}>
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="hide-native-password-toggle w-full bg-[#f3f3f5] border-0 rounded-lg px-3 py-2 text-base text-[#0a0a0a] placeholder:text-[#717182] focus:ring-2 focus:ring-[#155dfc] outline-none pr-10"
                                placeholder="Enter your password"
                                style={{ fontFamily: "Arimo, sans-serif" }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((currentValue) => !currentValue)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#0a0a0a]"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {errorMessage && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" style={{ fontFamily: "Arimo, sans-serif" }}>
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[#030213] text-white rounded-lg py-2.5 text-base font-normal hover:bg-[#1a1a2e] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                        style={{ fontFamily: "Arimo, sans-serif" }}
                    >
                        {isSubmitting ? "Logging in..." : "Login"}
                    </button>

                    <div className="pt-2 text-center">
                        <span className="text-base text-[#6a7282]" style={{ fontFamily: "Arimo, sans-serif" }}>
                            Don&apos;t have an account?{" "}
                        </span>
                        <button
                            type="button"
                            onClick={onRegister}
                            className="text-[#155dfc] hover:underline text-base"
                            style={{ fontFamily: "Arimo, sans-serif" }}
                        >
                            Register here
                        </button>
                    </div>
                </form>
            </div>

            {!embedded && (
                <div className="text-center mt-6">
                    <button
                        onClick={onBack}
                        className="text-[#155dfc] text-base hover:underline"
                        style={{ fontFamily: "Arimo, sans-serif" }}
                    >
                        ← Back to Home
                    </button>
                </div>
            )}
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            style={{
                backgroundImage: "linear-gradient(rgb(239, 246, 255) 0%, rgb(255, 255, 255) 100%)",
            }}
        >
            {content}
        </div>
    );
}
