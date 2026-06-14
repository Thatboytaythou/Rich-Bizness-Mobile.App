/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-toast.js

   GLOBAL TOAST / ALERT ENGINE

   Locked purpose:
   - Compatibility wrapper around rb-ui.js toast system
   - rb-ui.js owns the actual toast DOM engine
========================= */

import {
  toast as uiToast,
  success as uiSuccess,
  error as uiError,
  warning as uiWarning,
  info as uiInfo
} from "/core/shared/rb-ui.js";

/* =========================
   MAIN TOAST
========================= */

export function toast({
  title = "Rich Bizness",
  message = "",
  type = "info",
  duration = 3200
} = {}) {
  const finalMessage = message || title || "";

  const node = uiToast(finalMessage, {
    type,
    duration,
    icon:
      type === "success"
        ? "✅"
        : type === "error"
          ? "❌"
          : type === "warning"
            ? "⚠️"
            : type === "loading"
              ? "⏳"
              : "💨"
  });

  return () => {
    node?.remove?.();
  };
}

/* =========================
   TYPES
========================= */

export function toastSuccess(message, title = "Success") {
  return uiSuccess(message || title);
}

export function toastError(message, title = "Error") {
  return uiError(message || title);
}

export function toastInfo(message, title = "Rich Bizness") {
  return uiInfo(message || title);
}

export function toastWarn(message, title = "Heads up") {
  return uiWarning(message || title);
}

export function toastLoading(message = "Loading...", title = "Rich Bizness") {
  return toast({
    title,
    message,
    type: "loading",
    duration: 0
  });
}

/* =========================
   CLEAR ALL
========================= */

export function clearToasts() {
  if (typeof document === "undefined") return;

  document
    .querySelectorAll("#rb-toast-root .rb-toast")
    .forEach((node) => node.remove());
}

/* =========================
   GLOBAL COMPAT
========================= */

if (typeof window !== "undefined") {
  window.RBToast = toast;
  window.RBToastSuccess = toastSuccess;
  window.RBToastError = toastError;
  window.RBToastInfo = toastInfo;
  window.RBToastWarn = toastWarn;
  window.RBClearToasts = clearToasts;
}

console.log("RB TOAST ENGINE READY");
