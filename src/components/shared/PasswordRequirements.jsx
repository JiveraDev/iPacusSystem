import PropTypes from 'prop-types';
import { Check, X } from 'lucide-react';

import { getPasswordRequirementResults } from '../../lib/passwordPolicy.js';

export default function PasswordRequirements({ password, confirmPassword, className = '' }) {
    const requirements = getPasswordRequirementResults(password);
    if (confirmPassword !== undefined) {
        requirements.push({
            key: 'match',
            label: 'Passwords match',
            passed: String(confirmPassword).length > 0 && password === confirmPassword,
        });
    }

    return (
        <div className={`grid gap-1.5 text-xs sm:grid-cols-2 ${className}`} aria-live="polite">
            {requirements.map((requirement) => {
                const Icon = requirement.passed ? Check : X;

                return (
                    <p
                        key={requirement.key}
                        className={`flex items-center gap-1.5 font-semibold ${requirement.passed
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'}`}
                    >
                        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{requirement.label}</span>
                    </p>
                );
            })}
        </div>
    );
}

PasswordRequirements.propTypes = {
    password: PropTypes.string,
    confirmPassword: PropTypes.string,
    className: PropTypes.string,
};
