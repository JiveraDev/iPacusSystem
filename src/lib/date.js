function pad(value) {
  return String(value).padStart(2, "0");
}

function ensureDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function addDays(date, amount) {
  const nextDate = new Date(ensureDate(date));
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function differenceInDays(left, right) {
  const leftDate = ensureDate(left);
  const rightDate = ensureDate(right);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((leftDate.getTime() - rightDate.getTime()) / millisecondsPerDay);
}

function parseISO(value) {
  return new Date(value);
}

function isSameDay(left, right) {
  const leftDate = ensureDate(left);
  const rightDate = ensureDate(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function format(date, pattern) {
  const value = ensureDate(date);

  if (pattern === "yyyy-MM-dd") {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (pattern === "p") {
    return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  if (pattern === "PPP") {
    return value.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  }

  if (pattern === "PPPP") {
    return value.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return value.toLocaleString();
}

export { addDays, differenceInDays, format, isSameDay, parseISO };
