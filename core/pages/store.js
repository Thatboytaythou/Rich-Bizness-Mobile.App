// /core/pages/store.js
import { supabase } from "/core/shared/supabase.js";

const grid = document.getElementById("storeGrid");
const statusEl = document.getElementById("storeStatus");
const searchEl = document.getElementById("storeSearch");
const categoryEl = document.getElementById("storeCategory");
const typeEl = document.getElementById("storeType");

let sessionUser = null;
let products = [];

const money = (cents = 0, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format((Number(cents) || 0) / 100);

const img = (p) =>
  p.image_url ||
  p.cover_url ||
  p.media_url ||
  p.preview_url ||
  "/images/brand/project-avatar.png.jpeg";

const safe = (value, fallback = "") => String(value ?? fallback);

function setStatus(message = "") {
  statusEl.textContent = message;
  statusEl.style.display = message ? "block" : "none";
}

async function initStore() {
  const { data } = await supabase.auth.getSession();
  sessionUser = data?.session?.user || null;

  await loadProducts();
  bindFilters();
  subscribeProducts();
}

async function loadProducts() {
  setStatus("Loading marketplace...");

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      seller_id,
      title,
      description,
      category,
      product_type,
      fulfillment_type,
      price_cents,
      currency,
      image_url,
      cover_url,
      media_url,
      preview_url,
      digital_file_url,
      quantity,
      inventory_count,
      is_digital,
      is_local,
      is_featured,
      is_public,
      city,
      state,
      location_label,
      status,
      views,
      likes,
      sales_count,
      marketing_emoji,
      drop_style,
      metadata,
      created_at,
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

  if (error) {
    console.error(error);
    setStatus("Store could not load right now.");
    return;
  }

  products = data || [];
  hydrateCategories(products);
  renderProducts();
}

function hydrateCategories(items) {
  const current = categoryEl.value || "all";
  const categories = [...new Set(items.map((p) => p.category).filter(Boolean))];

  categoryEl.innerHTML = `<option value="all">All categories</option>`;
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryEl.appendChild(option);
  });

  categoryEl.value = categories.includes(current) ? current : "all";
}

function filteredProducts() {
  const term = searchEl.value.trim().toLowerCase();
  const category = categoryEl.value;
  const type = typeEl.value;

  return products.filter((p) => {
    const text = `${p.title} ${p.description} ${p.category} ${p.product_type}`.toLowerCase();
    const matchesSearch = !term || text.includes(term);
    const matchesCategory = category === "all" || p.category === category;
    const matchesType = type === "all" || p.product_type === type;
    return matchesSearch && matchesCategory && matchesType;
  });
}

function renderProducts() {
  const items = filteredProducts();

  if (!items.length) {
    grid.innerHTML = "";
    setStatus("No products found.");
    return;
  }

  setStatus("");

  grid.innerHTML = items
    .map((p) => {
      const seller = Array.isArray(p.store_seller_profiles)
        ? p.store_seller_profiles[0]
        : p.store_seller_profiles;

      const sellerName =
        seller?.seller_name ||
        seller?.display_name ||
        seller?.username ||
        "Rich Bizness Seller";

      const soldOut =
        Number(p.inventory_count || p.quantity || 0) <= 0 &&
        !p.is_digital &&
        p.fulfillment_type === "shipping";

      return `
        <article class="rb-store-card" data-product-id="${p.id}">
          <div class="rb-store-media">
            <img src="${img(p)}" alt="${safe(p.title)}" loading="lazy" />
            ${p.is_featured ? `<span class="rb-store-badge">Featured</span>` : ""}
            ${soldOut ? `<span class="rb-store-badge rb-danger">Sold Out</span>` : ""}
          </div>

          <div class="rb-store-info">
            <div class="rb-store-row">
              <span>${safe(p.marketing_emoji, "💨")} ${safe(p.category, "general")}</span>
              <strong>${money(p.price_cents, p.currency)}</strong>
            </div>

            <h2>${safe(p.title, "Untitled Drop")}</h2>
            <p>${safe(p.description, "No description yet.")}</p>

            <div class="rb-store-meta">
              <span>${safe(p.product_type, "physical")}</span>
              <span>${safe(p.fulfillment_type, "shipping")}</span>
              <span>${Number(p.likes || 0)} likes</span>
              <span>${Number(p.sales_count || 0)} sold</span>
            </div>

            <div class="rb-store-seller">
              <img src="${seller?.avatar_url || "/images/brand/project-avatar.png.jpeg"}" alt="" />
              <div>
                <strong>${sellerName}</strong>
                <small>${seller?.seller_rank || "Rookie Seller"}</small>
              </div>
            </div>

            <div class="rb-store-buttons">
              <button data-action="buy" data-id="${p.id}" ${soldOut ? "disabled" : ""}>
                Buy Now
              </button>
              <button data-action="cart" data-id="${p.id}" ${soldOut ? "disabled" : ""}>
                Add Cart
              </button>
              <button data-action="like" data-id="${p.id}">
                💸 Like
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  bindProductButtons();
  items.forEach((p) => trackView(p.id));
}

function bindFilters() {
  [searchEl, categoryEl, typeEl].forEach((el) => {
    el.addEventListener("input", renderProducts);
    el.addEventListener("change", renderProducts);
  });
}

function bindProductButtons() {
  grid.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "buy") return buyProduct(id, btn);
      if (action === "cart") return addToCart(id, btn);
      if (action === "like") return likeProduct(id, btn);
    });
  });
}

async function requireUser() {
  if (sessionUser) return sessionUser;

  const { data } = await supabase.auth.getSession();
  sessionUser = data?.session?.user || null;

  if (!sessionUser) {
    window.location.href = `/auth.html?next=${encodeURIComponent("/store.html")}`;
    return null;
  }

  return sessionUser;
}

async function buyProduct(productId, btn) {
  const user = await requireUser();
  if (!user) return;

  btn.disabled = true;
  btn.textContent = "Opening checkout...";

  try {
    const res = await fetch("/api/create-store-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity: 1 }),
    });

    const json = await res.json();

    if (!res.ok || !json?.url) {
      throw new Error(json?.error || "Checkout failed");
    }

    window.location.href = json.url;
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = "Buy Now";
    alert(err.message || "Checkout failed.");
  }
}

async function addToCart(productId, btn) {
  const user = await requireUser();
  if (!user) return;

  const product = products.find((p) => p.id === productId);
  if (!product) return;

  btn.disabled = true;
  btn.textContent = "Adding...";

  const { error } = await supabase.from("store_cart_items").insert({
    user_id: user.id,
    product_id: product.id,
    seller_id: product.seller_id || null,
    quantity: 1,
    price_cents: product.price_cents || 0,
    currency: product.currency || "usd",
    metadata: {
      source: "store.html",
      product_type: product.product_type,
      fulfillment_type: product.fulfillment_type,
    },
  });

  btn.disabled = false;
  btn.textContent = error ? "Try Again" : "Added ✓";

  if (error) console.error(error);
}

async function likeProduct(productId, btn) {
  const user = await requireUser();
  if (!user) return;

  btn.disabled = true;

  const { error } = await supabase.from("product_likes").insert({
    product_id: productId,
    user_id: user.id,
    reaction: "💸",
  });

  if (!error) {
    await supabase.rpc?.("noop").catch(() => {});
    const product = products.find((p) => p.id === productId);
    if (product) product.likes = Number(product.likes || 0) + 1;
    renderProducts();
  } else {
    console.error(error);
    btn.disabled = false;
  }
}

async function trackView(productId) {
  try {
    await supabase.from("product_views").insert({
      product_id: productId,
      user_id: sessionUser?.id || null,
      anonymous_id: sessionUser ? null : getAnonId(),
    });
  } catch (_) {}
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

function subscribeProducts() {
  supabase
    .channel("store-products-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "products" },
      () => loadProducts()
    )
    .subscribe();
}

initStore();
