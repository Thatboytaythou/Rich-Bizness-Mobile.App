/* =========================
   RICH BIZNESS MOBILE
   /core/pages/store.js

   STORE PAGE CONTROLLER
   Products + Cart + Likes + Views + Checkout
   Profile Keys Locked
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

const money = (cents = 0, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase()
  }).format((Number(cents) || 0) / 100);

const safe = (value, fallback = "") => String(value ?? fallback);

function imageFor(product) {
  return (
    product.image_url ||
    product.cover_url ||
    product.media_url ||
    product.preview_url ||
    FALLBACK_IMAGE
  );
}

function setStatus(message = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.display = message ? "block" : "none";
}

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "store";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell();

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

async function requireUser() {
  if (currentUser?.id) return currentUser;

  syncProfileKeys();

  if (!currentUser?.id) {
    window.location.href = `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(RB_ROUTES.store || "/store")}`;
    return null;
  }

  return currentUser;
}

function hydrateCategories(items) {
  if (!categoryEl) return;

  const current = categoryEl.value || "all";
  const categories = [
    ...new Set(items.map((item) => item.category).filter(Boolean))
  ];

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
      ${product.title}
      ${product.description}
      ${product.category}
      ${product.product_type}
      ${product.fulfillment_type}
      ${product.city}
      ${product.state}
    `.toLowerCase();

    return (
      (!term || text.includes(term)) &&
      (category === "all" || product.category === category) &&
      (type === "all" || product.product_type === type)
    );
  });
}

function sellerFor(product) {
  const seller = product.store_seller_profiles;

  if (Array.isArray(seller)) return seller[0] || null;
  return seller || null;
}

function renderProducts() {
  if (!grid) return;

  const items = filteredProducts();

  if (!items.length) {
    grid.innerHTML = "";
    setStatus("No products found.");
    return;
  }

  setStatus("");

  grid.innerHTML = items.map((product) => {
    const seller = sellerFor(product);

    const sellerName =
      seller?.seller_name ||
      seller?.display_name ||
      seller?.username ||
      "Rich Bizness Seller";

    const soldOut =
      Number(product.inventory_count || product.quantity || 0) <= 0 &&
      !product.is_digital &&
      product.fulfillment_type === "shipping";

    return `
      <article
        class="rb-store-card"
        data-product-id="${product.id}"
        data-seller-id="${product.seller_id || ""}"
        data-profile-locked="${product.seller_id ? "true" : "false"}"
      >
        <div class="rb-store-media">
          <img src="${imageFor(product)}" alt="${safe(product.title)}" loading="lazy" />

          ${product.is_featured ? `<span class="rb-store-badge">Featured</span>` : ""}
          ${soldOut ? `<span class="rb-store-badge rb-danger">Sold Out</span>` : ""}
        </div>

        <div class="rb-store-info">
          <div class="rb-store-row">
            <span>${safe(product.marketing_emoji, "💨")} ${safe(product.category, "general")}</span>
            <strong>${money(product.price_cents, product.currency)}</strong>
          </div>

          <h2>${safe(product.title, "Untitled Drop")}</h2>
          <p>${safe(product.description, "No description yet.")}</p>

          <div class="rb-store-meta">
            <span>${safe(product.product_type, "physical")}</span>
            <span>${safe(product.fulfillment_type, "shipping")}</span>
            <span>${Number(product.likes || 0)} likes</span>
            <span>${Number(product.sales_count || 0)} sold</span>
          </div>

          <div class="rb-store-seller">
            <img src="${seller?.avatar_url || FALLBACK_IMAGE}" alt="" loading="lazy" />
            <div>
              <strong>${sellerName}</strong>
              <small>${seller?.seller_rank || "Rookie Seller"}</small>
            </div>
          </div>

          <div class="rb-store-buttons">
            <button data-action="buy" data-id="${product.id}" ${soldOut ? "disabled" : ""}>Buy Now</button>
            <button data-action="cart" data-id="${product.id}" ${soldOut ? "disabled" : ""}>Add Cart</button>
            <button data-action="like" data-id="${product.id}">💸 Like</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  bindProductButtons();
  items.forEach((item) => trackView(item.id));
}

function bindFilters() {
  [searchEl, categoryEl, typeEl].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", renderProducts);
    el.addEventListener("change", renderProducts);
  });
}

function bindProductButtons() {
  grid?.querySelectorAll("button[data-action]").forEach((button) => {
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
  setStatus("Loading marketplace...");

  const { data, error } = await supabase
    .from(RB_TABLES.products)
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity: 1 })
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
    alert(error.message || "Checkout failed.");
  }
}

async function addToCart(productId, button) {
  const user = await requireUser();
  if (!user) return;

  const product = products.find((item) => item.id === productId);
  if (!product) return;

  button.disabled = true;
  button.textContent = "Adding...";

  const { error } = await supabase
    .from(RB_TABLES.storeCartItems)
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

  if (error) console.error("[store cart]", error);
}

async function likeProduct(productId, button) {
  const user = await requireUser();
  if (!user) return;

  button.disabled = true;

  const { error } = await supabase
    .from(RB_TABLES.productLikes)
    .insert({
      product_id: productId,
      user_id: user.id,
      reaction: "💸"
    });

  if (error) {
    console.error("[store like]", error);
    button.disabled = false;
    return;
  }

  const product = products.find((item) => item.id === productId);
  if (product) product.likes = Number(product.likes || 0) + 1;

  renderProducts();
}

async function trackView(productId) {
  try {
    await supabase
      .from(RB_TABLES.productViews)
      .insert({
        product_id: productId,
        user_id: currentUser?.id || null,
        anonymous_id: currentUser?.id ? null : getAnonId()
      });
  } catch (_) {}
}

function bindRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  channel = supabase
    .channel("rb-store-products")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.products },
      loadProducts
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.productLikes },
      loadProducts
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.storeCartItems },
      loadProducts
    )
    .subscribe();

  window.addEventListener("beforeunload", () => {
    if (channel) supabase.removeChannel(channel);
  });
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

    document.body.classList.add("rb-store-ready");

    markPageReady("store");

    console.log("RB STORE READY", {
      profileLocked: !!profileIdentity?.id,
      route: "store"
    });
  } catch (error) {
    console.error("[store.js]", error);
    setStatus("Store could not load right now.");
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootStorePage);
} else {
  bootStorePage();
}
