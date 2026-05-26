import { useState } from 'react';
import imgImageVfcLogo from "../assets/circular_logo.png";
import { Card } from '../ui/card.jsx';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft } from 'lucide-react';
import PasswordInput from './shared/PasswordInput.jsx';

export function RegistrationForm({ onBackHome, onLogin, onContinue, embedded = false, initialValues }) {
    const [email, setEmail] = useState(initialValues?.email ?? '');
    const [password, setPassword] = useState(initialValues?.password ?? '');
    const [confirmPassword, setConfirmPassword] = useState(initialValues?.confirmPassword ?? '');
    const [errors, setErrors] = useState({});

    const handleSubmit = (e) => {
        e.preventDefault();
        const newErrors = {};

        // Validation
        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Continue to next step - always set role as 'pet_owner'
        setErrors({});
        onContinue({ email, password, confirmPassword, role: 'pet_owner' });
    };

    const content = (
        <div className="w-full max-w-[672px]">
            {/* Header */}
            <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
                <img src={imgImageVfcLogo} alt="iPawcus" className="w-14 h-14 object-contain" />
                <h1 className="text-3xl font-bold text-[#155dfc]">iPawcus</h1>
            </div>
            <p className="text-gray-600">Create your account to get started</p>
        </div>

            {/* Form Card */}
            <Card className="p-4 shadow-lg border border-gray-200 sm:p-6">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Register - Create Account</h2>
                    <p className="text-gray-500">Step 1 of 2: Account Credentials</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Address */}
                    <div>
                        <Label htmlFor="email" className="text-gray-900 mb-2 block">
                            Email Address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="your.email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`bg-gray-100 border-gray-300 ${errors.email ? 'border-red-500' : ''}`}
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>

                    {/* Password */}
                    <div>
                        <Label htmlFor="password" className="text-gray-900 mb-2 block">
                            Password
                        </Label>
                        <PasswordInput
                            id="password"
                            placeholder="At least 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            inputClassName={`bg-gray-100 border-gray-300 ${errors.password ? 'border-red-500' : ''}`}
                        />
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <Label htmlFor="confirmPassword" className="text-gray-900 mb-2 block">
                            Confirm Password
                        </Label>
                        <PasswordInput
                            id="confirmPassword"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            inputClassName={`bg-gray-100 border-gray-300 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                        />
                        {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                    </div>

                    {/* Submit Button */}
                    <Button type="submit" className="w-full bg-[#030213] hover:bg-[#030213]/90 text-white py-6 text-base">
                        Continue to Personal Information
                    </Button>

                    {/* Login Link */}
                    <div className="text-center">
                        <p className="text-gray-600 inline">Already have an account? </p>
                        <button type="button" onClick={onLogin} className="text-[#155dfc] hover:underline">
                            Login here
                        </button>
                    </div>
                </form>
            </Card>

            {!embedded && (
                <div className="text-center mt-6">
                    <button onClick={onBackHome} className="text-[#155dfc] hover:underline inline-flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </button>
                </div>
            )}
        </div>
    );



return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)' }}>
        {content}
    </div>
);
}
