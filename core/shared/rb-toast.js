/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-toast.js

   GLOBAL TOAST / ALERT ENGINE
   FINAL LOCKED VERSION
========================= */

let toastRoot = null;

const ACTIVE_TOASTS = new Set();

const MAX_TOASTS = 5;

/* =========================
   ROOT
========================= */

function ensureToastRoot() {
  if (toastRoot) {
    return toastRoot;
  }

  toastRoot = document.createElement("div");

  toastRoot.id = "rb-toast-root";

  toastRoot.className =
    "rb-toast-root";

  toastRoot.setAttribute(
    "aria-live",
    "polite"
  );

  toastRoot.setAttribute(
    "aria-atomic",
    "true"
  );

  document.body.appendChild(
    toastRoot
  );

  return toastRoot;
}

/* =========================
   REMOVE EXCESS
========================= */

function trimToasts() {
  const active =
    Array.from(ACTIVE_TOASTS);

  if (active.length <= MAX_TOASTS) {
    return;
  }

  const overflow =
    active.length - MAX_TOASTS;

  for (let i = 0; i < overflow; i++) {
    active[i]?.close?.();
  }
}

/* =========================
   MAIN TOAST
========================= */

export function toast({
  title = "Rich Bizness",
  message = "",
  type = "info",
  duration = 3200
} = {}) {
  const root =
    ensureToastRoot();

  const item =
    document.createElement("div");

  item.className =
    `rb-toast rb-toast-${type}`;

  item.setAttribute(
    "data-toast-type",
    type
  );

  item.innerHTML = `
    <div class="rb-toast-orb"></div>

    <div class="rb-toast-copy">
      <strong>${title}</strong>

      ${
        message
          ? `<span>${message}</span>`
          : ""
      }
    </div>

    <button
      class="rb-toast-close"
      type="button"
      aria-label="Close"
    >
      ×
    </button>
  `;

  root.appendChild(item);

  requestAnimationFrame(() => {
    item.classList.add(
      "is-visible"
    );
  });

  let closed = false;

  const close = () => {
    if (closed) return;

    closed = true;

    ACTIVE_TOASTS.delete(api);

    item.classList.remove(
      "is-visible"
    );

    item.classList.add(
      "is-leaving"
    );

    window.setTimeout(() => {
      item.remove();
    }, 260);
  };

  item
    .querySelector(
      ".rb-toast-close"
    )
    ?.addEventListener(
      "click",
      close
    );

  if (duration > 0) {
    window.setTimeout(
      close,
      duration
    );
  }

  const api = {
    element: item,
    close
  };

  ACTIVE_TOASTS.add(api);

  trimToasts();

  return close;
}

/* =========================
   SUCCESS
========================= */

export function toastSuccess(
  message,
  title = "Success"
) {
  return toast({
    title,
    message,
    type: "success",
    duration: 3200
  });
}

/* =========================
   ERROR
========================= */

export function toastError(
  message,
  title = "Error"
) {
  return toast({
    title,
    message,
    type: "error",
    duration: 5200
  });
}

/* =========================
   INFO
========================= */

export function toastInfo(
  message,
  title = "Rich Bizness"
) {
  return toast({
    title,
    message,
    type: "info",
    duration: 3200
  });
}

/* =========================
   WARNING
========================= */

export function toastWarn(
  message,
  title = "Heads up"
) {
  return toast({
    title,
    message,
    type: "warning",
    duration: 4200
  });
}

/* =========================
   LOADING
========================= */

export function toastLoading(
  message = "Loading...",
  title = "Rich Bizness"
) {
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
  Array.from(ACTIVE_TOASTS).forEach(
    (toastRef) => {
      toastRef.close();
    }
  );
}

console.log(
  "RB TOAST ENGINE READY"
);
