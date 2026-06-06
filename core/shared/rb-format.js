/* =========================
   RICH BIZNESS FORMAT CORE
   /core/shared/rb-format.js
========================= */

function toNumber(value = 0, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function validDate(dateValue) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* =========================
   NUMBER FORMAT
========================= */
export function formatNumber(value = 0) {
  const num = toNumber(value, 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1000000000) {
    return `${sign}${(abs / 1000000000).toFixed(1).replace(/\.0$/, "")}B`;
  }

  if (abs >= 1000000) {
    return `${sign}${(abs / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return String(num);
}

/* =========================
   CURRENCY
   amount is cents by default
========================= */
export function formatCurrency(amount = 0, currency = "USD") {
  const cents = toNumber(amount, 0);
  const code = String(currency || "USD").toUpperCase();

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

/* =========================
   DATE
========================= */
export function formatDate(dateValue) {
  const date = validDate(dateValue);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

/* =========================
   TIME AGO
========================= */
export function timeAgo(dateValue) {
  const then = validDate(dateValue);
  if (!then) return "Now";

  const now = new Date();
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 0) return "Just now";
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(dateValue);
}

/* =========================
   DURATION
========================= */
export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(toNumber(seconds, 0)));

  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/* =========================
   FILE SIZE
========================= */
export function formatFileSize(bytes = 0) {
  const value = Math.max(0, toNumber(bytes, 0));

  if (!value) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    sizes.length - 1
  );

  return `${(value / Math.pow(1024, index)).toFixed(1)} ${sizes[index]}`;
}

/* =========================
   USERNAME
========================= */
export function formatUsername(username = "") {
  const clean = String(username || "").trim();

  if (!clean) return "@richbizness";
  if (clean.startsWith("@")) return clean;

  return `@${clean}`;
}

/* =========================
   SLUG
========================= */
export function slugify(text = "") {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* =========================
   CAPITALIZE
========================= */
export function capitalize(text = "") {
  const clean = String(text || "").trim();
  if (!clean) return "";

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

console.log("RB FORMAT CORE READY");
