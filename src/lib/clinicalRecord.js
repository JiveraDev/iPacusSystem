function normalizedClinicalText(value) {
    return String(value ?? '').trim();
}

export function dedupeClinicalFields(fields) {
    const keysByValue = new Map();

    fields.forEach(([key, value]) => {
        const normalized = normalizedClinicalText(value);
        if (!normalized) {
            return;
        }

        const matchingKeys = keysByValue.get(normalized) || [];
        matchingKeys.push(key);
        keysByValue.set(normalized, matchingKeys);
    });

    const suppressedKeys = new Set();
    keysByValue.forEach((matchingKeys, normalized) => {
        if (matchingKeys.length < 3) {
            return;
        }

        const diagnosisKey = matchingKeys.includes('diagnosis') ? 'diagnosis' : '';
        const isHighConfidencePropagation = matchingKeys.length >= 4
            || (diagnosisKey && normalized.length <= 80);
        if (!isHighConfidencePropagation) {
            return;
        }

        const winner = diagnosisKey || matchingKeys[0];
        matchingKeys.forEach((key) => {
            if (key !== winner) {
                suppressedKeys.add(key);
            }
        });
    });

    return Object.fromEntries(fields.map(([key, value]) => [
        key,
        suppressedKeys.has(key) ? '' : String(value ?? '').trim()
    ]));
}
