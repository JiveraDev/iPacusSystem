function clsx(...inputs) {
  const classes = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
      continue;
    }

    if (Array.isArray(input)) {
      classes.push(clsx(...input));
      continue;
    }

    if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(" ");
}

function splitVariant(token) {
  let depth = 0;

  for (let index = token.length - 1; index >= 0; index -= 1) {
    const char = token[index];
    if (char === "]") depth += 1;
    if (char === "[") depth -= 1;
    if (char === ":" && depth === 0) {
      return {
        variant: token.slice(0, index + 1),
        utility: token.slice(index + 1),
      };
    }
  }

  return { variant: "", utility: token };
}

function utilityGroup(utility) {
  const normalized = utility.startsWith("!") ? utility.slice(1) : utility;
  if (/^text-(xs|sm|base|lg|xl|[2-9]xl|\[.+\])$/.test(normalized)) {
    return "text-size";
  }

  const groups = [
    "size",
    "min-h",
    "max-h",
    "h",
    "min-w",
    "max-w",
    "w",
    "p",
    "px",
    "py",
    "pt",
    "pr",
    "pb",
    "pl",
    "rounded",
    "leading",
    "whitespace",
  ];

  return groups.find((group) => normalized === group || normalized.startsWith(`${group}-`));
}

function twMerge(className) {
  const tokens = className.split(/\s+/).filter(Boolean);
  const seen = new Map();
  const result = [];

  for (const token of tokens) {
    if (token.startsWith("[") || token.includes(":[")) {
      result.push(token);
      continue;
    }

    const { variant, utility } = splitVariant(token);
    const group = utilityGroup(utility);

    if (!group) {
      result.push(token);
      continue;
    }

    const key = `${variant}${group}`;
    const existingIndex = seen.get(key);
    if (existingIndex !== undefined) {
      result[existingIndex] = token;
    } else {
      seen.set(key, result.length);
      result.push(token);
    }
  }

  return result.join(" ");
}

export function cn(...inputs) {
  return twMerge(clsx(...inputs));
}

