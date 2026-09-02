export function formatDisplayPersonName(value, fallback = 'Name unavailable') {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if (!name) return fallback;

    const prefixMatch = name.match(/^dr\.?\s+/i);
    const prefix = prefixMatch ? 'Dr. ' : '';
    const nameWithoutPrefix = prefixMatch ? name.slice(prefixMatch[0].length) : name;
    const shouldNormalizeCase = nameWithoutPrefix === nameWithoutPrefix.toUpperCase()
        || nameWithoutPrefix === nameWithoutPrefix.toLowerCase();
    const normalizedName = shouldNormalizeCase
        ? nameWithoutPrefix.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
        : nameWithoutPrefix;

    return `${prefix}${normalizedName}`;
}
