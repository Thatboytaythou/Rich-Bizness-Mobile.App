/* =========================
   RICH BIZNESS MOBILE
   /core/pages/store.js

   STORE PAGE CONTROLLER
   Products + Cart + Likes + Views + Checkout
   Profile Keys Locked

   Updates:
   - No project-avatar fallback
   - Safe HTML escaping
   - Direct table fallbacks
   - Product likes upsert-safe
   - View tracking de-duped per session
   - Realtime cleanup locked
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);

const FALLBACK_IMAGE = "/images/brand/hero-banner.png";
const FALLBACK_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const grid = $("storeGrid");
const statusEl = $("storeStatus");
const searchEl = $("storeSearch");
const categoryEl = $("storeCategory");
const typeEl = $("storeType");

let supabase = null;
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;
let products = [];
let channel = null;
let filtersBound = false;

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function money(cents = 0, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase()
  }).format((Number(cents) || 0) / 100);
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeText(value, fallback = "") {
  const text = String(value ?? fallback ?? "").trim();
  return text || fallback;
}

function safePath(value = "", fallback = FALLBACK_IMAGE) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) return fallback;

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function imageFor(product = {}) {
  return safePath(
    product.image_url ||
      product.cover_url ||
      product.media_url ||
      product.preview_url ||
      product.digital_file_url,
    FALLBACK_IMAGE
  );
}

function setStatus(message = "", type = "info") {
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.dataset.type = type;
  statusEl.style.display = message ? "block" : "none";
}

function syncProfileKeys() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || null;
  currentProfile = appState.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "store";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell?.();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });
}

function getAnonId() {
  const key = "rb_anon_id";
  let id = localStorage.getItem(key);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }

  return id;
}

function markViewed(productId) {
  const key = `rb_store_viewed_${productId}`;
  if (sessionStorage.getItem(key)) return false;

  sessionStorage.setItem(key, "true");
  return true;
}

async function requireUser() {
  if (currentUser?.id) return currentUser;

  syncProfileKeys();

  if (!currentUser?.id) {
    window.location.href =
      `${RB_ROUTES?.auth || "/auth"}?next=${encodeURIComponent(RB_ROUTES?.store || "/store")}`;
    return null;
  }

  return currentUser;
}

function hydrateCategories(items = []) {
  if (!categoryEl) return;

  const current = categoryEl.value || "all";
  const categories = [
    ...new Set(items.map((item) => item.category).filter(Boolean))
  ].sort();

  categoryEl.innerHTML = `<option value="all">All categories</option>`;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryEl.appendChild(option);
  });

  categoryEl.value = categories.includes(current) ? current : "all";
}

function filteredProducts() {
  const term = String(searchEl?.value || "").trim().toLowerCase();
  const category = categoryEl?.value || "all";
  const type = typeEl?.value || "all";

  return products.filter((product) => {
    const text = `
      ${product.title || ""}
      ${product.description || ""}
      ${product.category || ""}
      ${product.product_type || ""}
      ${product.fulfillment_type || ""}
      ${product.city || ""}
      ${product.state || ""}
      ${product.location_label || ""}
    `.toLowerCase();

    return (
      (!term || text.includes(term)) &&
      (category === "all" || product.category === category) &&
      (type === "all" || product.product_type === type)
    );
  });
}

function sellerFor(product = {}) {
  const seller = product.store_seller_profiles;

  if (Array.isArray(seller)) return seller[0] || null;
  return seller || null;
}

function isSoldOut(product = {}) {
  const stock = Number(product.inventory_count ?? product.quantity ?? 0);

  return (
    stock <= 0 &&
    !product.is_digital &&
    product.fulfillment_type === "shipping"
  );
}

function renderProducts() {
  if (!grid) return;

  const items = filteredProducts();

  if (!items.length) {
    grid.innerHTML = "";
    setStatus("No products found.", "info");
    return;
  }

  setStatus("");

  grid.innerHTML = items
    .map((product) => {
      const seller = sellerFor(product);

      const sellerName =
        seller?.seller_name ||
        seller?.display_name ||
        seller?.username ||
        "Rich Bizness Seller";

      const soldOut = isSoldOut(product);
      const productImage = imageFor(product);
      const sellerAvatar = safePath(seller?.avatar_url, FALLBACK_AVATAR);

      return `
        <article
          class="rb-store-card"
          data-product-id="${escapeHtml(product.id)}"
          data-seller-id="${escapeHtml(product.seller_id || "")}"
          data-profile-locked="${product.seller_id ? "true" : "false"}"
        >
          <div class="rb-store-media">
            <img
              src="${escapeHtml(productImage)}"
              alt="${escapeHtml(safeText(product.title, "Rich Bizness Product"))}"
              loading="lazy"
            />

            ${product.is_featured ? `<span class="rb-store-badge">Featured</span>` : ""}
            ${soldOut ? `<span class="rb-store-badge rb-danger">Sold Out</span>` : ""}
          </div>

          <div class="rb-store-info">
            <div class="rb-store-row">
              <span>${escapeHtml(safeText(product.marketing_emoji, "💨"))} ${escapeHtml(safeText(product.category, "general"))}</span>
              <strong>${escapeHtml(money(product.price_cents, product.currency))}</strong>
            </div>

            <h2>${escapeHtml(safeText(product.title, "Untitled Drop"))}</h2>

            <p>${escapeHtml(safeText(product.description, "No description yet."))}</p>

            <div class="rb-store-meta">
              <span>${escapeHtml(safeText(product.product_type, "physical"))}</span>
              <span>${escapeHtml(safeText(product.fulfillment_type, "shipping"))}</span>
              <span>${Number(product.likes || 0).toLocaleString()} likes</span>
              <span>${Number(product.sales_count || 0).toLocaleString()} sold</span>
            </div>

            <div class="rb-store-seller">
              <img
                src="${escapeHtml(sellerAvatar)}"
                alt="${escapeHtml(sellerName)}"
                loading="lazy"
              />

              <div>
                <strong>${escapeHtml(sellerName)}</strong>
                <small>${escapeHtml(safeText(seller?.seller_rank, "Rookie Seller"))}</small>
              </div>
            </div>

            <div class="rb-store-buttons">
              <button data-action="buy" data-id="${escapeHtml(product.id)}" ${soldOut ? "disabled" : ""}>
                Buy Now
              </button>

              <button data-action="cart" data-id="${escapeHtml(product.id)}" ${soldOut ? "disabled" : ""}>
                Add Cart
              </button>

              <button data-action="like" data-id="${escapeHtml(product.id)}">
                💸 Like
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  bindProductButtons();
  items.forEach((item) => trackView(item.id));
}

function bindFilters() {
  if (filtersBound) return;
  filtersBound = true;

  [searchEl, categoryEl, typeEl].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", renderProducts);
    el.addEventListener("change", renderProducts);
  });
}

function bindProductButtons() {
  grid?.querySelectorAll("button[data-action]").forEach((button) => {
    if (button.dataset.rbBound === "true") return;
    button.dataset.rbBound = "true";

    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const action = button.dataset.action;

      if (action === "buy") return buyProduct(id, button);
      if (action === "cart") return addToCart(id, button);
      if (action === "like") return likeProduct(id, button);
    });
  });
}

async function loadProducts() {
  setStatus("Loading marketplace...", "info");

  const { data, error } = await supabase
    .from(table("products", "products"))
    .select(`
      *,
      store_seller_profiles:seller_id (
        user_id,
        seller_name,
        username,
        display_name,
        avatar_url,
        banner_url,
        seller_rank,
        location_label,
        payouts_enabled,
        stripe_onboarding_complete
      )
    `)
    .eq("is_public", true)
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  products = data || [];
  hydrateCategories(products);
  renderProducts();
}

async function buyProduct(productId, button) {
  const user = await requireUser();
  if (!user) return;

  button.disabled = true;
  button.textContent = "Opening checkout...";

  try {
    const response = await fetch("/api/create-store-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        product_id: productId,
        quantity: 1
      })
    });

    const json = await response.json();

    if (!response.ok || !json?.url) {
      throw new Error(json?.error || "Checkout failed.");
    }

    window.location.href = json.url;
  } catch (error) {
    console.error("[store checkout]", error);
    button.disabled = false;
    button.textContent = "Buy Now";
    setStatus(error.message || "Checkout failed.", "error");
  }
}

async function addToCart(productId, button) {
  const user = await requireUser();
  if (!user) return;

  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  button.disabled = true;
  button.textContent = "Adding...";

  const { error } = await supabase
    .from(table("storeCartItems", "store_cart_items"))
    .insert({
      user_id: user.id,
      product_id: product.id,
      seller_id: product.seller_id || null,
      quantity: 1,
      price_cents: product.price_cents || 0,
      currency: product.currency || "usd",
      metadata: {
        source: "store.js",
        profile_id: profileIdentity?.id || user.id,
        product_type: product.product_type,
        fulfillment_type: product.fulfillment_type
      }
    });

  button.disabled = false;
  button.textContent = error ? "Try Again" : "Added ✓";

  if (error) {
    console.error("[store cart]", error);
    setStatus(error.message || "Could not add to cart.", "error");
    return;
  }

  setStatus("Added to cart.", "success");
}

async function likeProduct(productId, button) {
  const user = await requireUser();
  if (!user) return;

  button.disabled = true;

  const { error } = await supabase
    .from(table("productLikes", "product_likes"))
    .upsert(
      {
        product_id: productId,
        user_id: user.id,
        reaction: "💸"
      },
      {
        onConflict: "product_id,user_id"
      }
    );

  if (error) {
    console.error("[store like]", error);
    button.disabled = false;
    setStatus(error.message || "Like failed.", "error");
    return;
  }

  const product = products.find((item) => String(item.id) === String(productId));
  if (product) product.likes = Number(product.likes || 0) + 1;

  renderProducts();
}

async function trackView(productId) {
  if (!productId || !markViewed(productId)) return;

  try {
    await supabase
      .from(table("productViews", "product_views"))
      .insert({
        product_id: productId,
        user_id: currentUser?.id || null,
        anonymous_id: currentUser?.id ? null : getAnonId()
      });
  } catch (_) {}
}

function clearRealtime() {
  if (channel && supabase) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function bindRealtime() {
  clearRealtime();

  channel = supabase
    .channel("rb-store-products")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("products", "products")
      },
      loadProducts
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("productLikes", "product_likes")
      },
      loadProducts
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("storeCartItems", "store_cart_items")
      },
      loadProducts
    )
    .subscribe();

  window.addEventListener("beforeunload", clearRealtime);
}

async function bootStorePage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    syncProfileKeys();
    bindFilters();

    await loadProducts();

    bindRealtime();

    document.body.dataset.rbPage = "store";
    document.body.dataset.rbRoute = "store";
    document.body.dataset.rbProfileLock = profileIdentity?.id ? "true" : "false";
    document.body.classList.add("rb-store-ready");

    markPageReady("store");

    console.log("RB STORE READY", {
      profileLocked: !!profileIdentity?.id,
      route: "store"
    });
  } catch (error) {
    console.error("[store.js]", error);
    setStatus("Store could not load right now.", "error");
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootStorePage);
} else {
  bootStorePage();
}
