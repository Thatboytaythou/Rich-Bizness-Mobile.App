/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-toast.js

   GLOBAL TOAST / ALERT ENGINE
========================= */

let toastRoot = null;

function ensureToastRoot() {
  if (toastRoot) return toastRoot;

  toastRoot = document.createElement("div");
  toastRoot.id = "rb-toast-root";
  toastRoot.className = "rb-toast-root";
  toastRoot.setAttribute("aria-live", "polite");
  toastRoot.setAttribute("aria-atomic", "true");

  document.body.appendChild(toastRoot);

  return toastRoot;
}

export function toast({
  title = "Rich Bizness",
  message = "",
  type = "info",
  duration = 3200
} = {}) {
  const root = ensureToastRoot();

  const item = document.createElement("div");
  item.className = `rb-toast rb-toast-${type}`;

  item.innerHTML = `
    <div class="rb-toast-orb"></div>
    <div class="rb-toast-copy">
      <strong>${title}</strong>
      ${message ? `<span>${message}</span>` : ""}
    </div>
    <button class="rb-toast-close" type="button" aria-label="Close">×</button>
  `;

  root.appendChild(item);

  requestAnimationFrame(() => {
    item.classList.add("is-visible");
  });

  const close = () => {
    item.classList.remove("is-visible");
    item.classList.add("is-leaving");

    setTimeout(() => {
      item.remove();
    }, 260);
  };

  item
    .querySelector(".rb-toast-close")
    ?.addEventListener("click", close);

  if (duration > 0) {
    setTimeout(close, duration);
  }

  return close;
}

export function toastSuccess(message, title = "Success") {
  return toast({
    title,
    message,
    type: "success"
  });
}

export function toastError(message, title = "Error") {
  return toast({
    title,
    message,
    type: "error",
    duration: 5200
  });
}

export function toastInfo(message, title = "Rich Bizness") {
  return toast({
    title,
    message,
    type: "info"
  });
}

export function toastWarn(message, title = "Heads up") {
  return toast({
    title,
    message,
    type: "warning",
    duration: 4200
  });
}
