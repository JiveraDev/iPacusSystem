export const PASSWORD_REQUIREMENTS = [
    { key: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 },
    { key: 'uppercase', label: 'At least 1 uppercase letter', test: (value) => /[A-Z]/.test(value) },
    { key: 'number', label: 'At least 1 number', test: (value) => /\d/.test(value) },
    { key: 'special', label: 'At least 1 special character', test: (value) => /[^A-Za-z0-9\s]/.test(value) },
];

export function getPasswordRequirementResults(password = '') {
    const value = String(password);

    return PASSWORD_REQUIREMENTS.map((requirement) => ({
        ...requirement,
        passed: requirement.test(value),
    }));
}

export function isPasswordStrong(password = '') {
    return getPasswordRequirementResults(password).every((requirement) => requirement.passed);
}

export const PASSWORD_POLICY_MESSAGE = 'Use at least 8 characters with an uppercase letter, a number, and a special character.';
