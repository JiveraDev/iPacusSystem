import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../ui/input';
import { cn } from '../../ui/utils';

export default function PasswordInput({ className, inputClassName, ...props }) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className={cn('relative', className)}>
            <Input
                {...props}
                type={showPassword ? 'text' : 'password'}
                className={cn(
                    'hide-native-password-toggle h-11 min-h-11 appearance-none py-0 pr-10 text-[16px] leading-5',
                    inputClassName
                )}
            />
            <button
                type="button"
                onClick={() => setShowPassword(currentValue => !currentValue)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#717182] transition-colors hover:text-[#0a0a0a] disabled:pointer-events-none disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={props.disabled}
            >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
        </div>
    );
}
