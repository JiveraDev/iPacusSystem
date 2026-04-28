
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

function calculateAge(birthDate) {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const now = new Date();
  
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += lastMonth.getDate();
  }
  
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const plural = (count, unit) => `${count} ${unit}${count > 1 ? "s" : ""}`;

  // Hierarchical output logic
  if (years > 0) {
    return months > 0 
      ? `${plural(years, "year")} and ${plural(months, "month")}` 
      : plural(years, "year");
  }
  
  if (months > 0) {
    const weeks = Math.floor(days / 7);
    return weeks > 0 
      ? `${plural(months, "month")} and ${plural(weeks, "week")}` 
      : plural(months, "month");
  }
  
  const totalDays = differenceInDays(now, birth);
  if (totalDays >= 7) {
    const weeks = Math.floor(totalDays / 7);
    const remDays = totalDays % 7;
    return remDays > 0 
      ? `${plural(weeks, "week")} and ${plural(remDays, "day")}` 
      : plural(weeks, "week");
  }
  
  return totalDays > 0 ? plural(totalDays, "day") : "Newborn";
}

export { addDays, differenceInDays, format, isSameDay, parseISO, calculateAge };
