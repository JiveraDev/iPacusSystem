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

// Minimal merge shim to avoid external dependency.
function twMerge(className) {
  return className;
}

export function cn(...inputs) {
  return twMerge(clsx(...inputs));
}

