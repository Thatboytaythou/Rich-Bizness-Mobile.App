/* =========================
   RICH BIZNESS FORMAT CORE
   /core/shared/rb-format.js
========================= */

/* =========================
   NUMBER FORMAT
========================= */
export function formatNumber(value = 0) {
  const num = Number(value || 0);

  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  }

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }

  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }

  return String(num);
}

/* =========================
   CURRENCY
========================= */
export function formatCurrency(
  amount = 0,
  currency = "USD"
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format((amount || 0) / 100);
}

/* =========================
   DATE
========================= */
export function formatDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

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
  if (!dateValue) return "Now";

  const now = new Date();
  const then = new Date(dateValue);

  const seconds = Math.floor(
    (now - then) / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return formatDate(dateValue);
}

/* =========================
   DURATION
========================= */
export function formatDuration(seconds = 0) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/* =========================
   FILE SIZE
========================= */
export function formatFileSize(bytes = 0) {
  if (!bytes) return "0 B";

  const sizes = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB"
  ];

  const i = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  return `${(
    bytes / Math.pow(1024, i)
  ).toFixed(1)} ${sizes[i]}`;
}

/* =========================
   USERNAME
========================= */
export function formatUsername(username = "") {
  if (!username) return "@richbizness";

  if (username.startsWith("@")) {
    return username;
  }

  return `@${username}`;
}

/* =========================
   SLUG
========================= */
export function slugify(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* =========================
   CAPITALIZE
========================= */
export function capitalize(text = "") {
  if (!text) return "";

  return text.charAt(0).toUpperCase() +
    text.slice(1);
}
