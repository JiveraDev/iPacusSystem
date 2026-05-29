export function formatPhpCurrency(value, options = {}) {
    const {
        minimumFractionDigits = 0,
        maximumFractionDigits = 2,
    } = options;
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return 'PHP 0';
    }

    return `PHP ${numericValue.toLocaleString('en-US', {
        minimumFractionDigits,
        maximumFractionDigits,
    })}`;
}

export function normalizeCurrencyLabel(value, fallback = 'To be announced') {
    if (!value) {
        return fallback;
    }

    const normalized = String(value)
        .replace(/\u20b1\s*/g, 'PHP ')
        .replace(/\$\s*/g, 'PHP ')
        .replace(/\bphp\b/gi, 'PHP')
        .replace(/\s*-\s*/g, ' - ')
        .replace(/\s+/g, ' ')
        .trim();

    return normalized || fallback;
}
