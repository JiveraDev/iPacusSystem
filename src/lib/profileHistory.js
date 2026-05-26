function normalizeHistoryItem(item) {
  if (!item || typeof item !== "object") {
    return { title: "", description: "", years: "" };
  }

  return {
    id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: item.title || item.school || item.name || "",
    description: item.description || item.major || item.details || "",
    years: item.years || item.yearRange || item.period || "",
  };
}

function parseProfileHistory(value, fallbackText = "") {
  if (Array.isArray(value)) {
    return value.map(normalizeHistoryItem);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeHistoryItem);
      }
    } catch {
      return fallbackText || value
        ? [{ id: "legacy-entry", title: fallbackText || "Profile Entry", description: value, years: "" }]
        : [];
    }
  }

  return fallbackText
    ? [{ id: "legacy-entry", title: fallbackText, description: "", years: "" }]
    : [];
}

function cleanProfileHistory(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map(item => ({
      title: (item.title || "").trim(),
      description: (item.description || "").trim(),
      years: (item.years || "").trim(),
    }))
    .filter(item => item.title || item.description || item.years);
}

export { cleanProfileHistory, parseProfileHistory };
