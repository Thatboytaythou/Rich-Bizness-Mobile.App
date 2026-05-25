/* =========================
   RICH BIZNESS MOBILE
   /core/pages/creator.js

   CREATOR PAGE CONTROLLER
   Synced with auth + profile-state
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  refreshProfileState,
  onProfileState
} from "/core/features/profile/profile-state.js";

import {
  updateMyProfile,
  profileName,
  profileAvatar,
  profileHandle,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  toastInfo,
  toastSuccess,
  toastError
} from "/core/shared/rb-toast.js";

const supabase = getSupabase();

const $ = (id) => document.getElementById(id);

const els = {
  name: $("creator-user-name"),
  handle: $("creator-user-handle"),
  avatar: $("creator-user-avatar"),
  badge: $("creator-user-badge"),
  status: $("creator-status"),
  syncStatus: $("creator-sync-status"),

  postsCount: $("creator-posts-count"),
  liveCount: $("creator-live-count"),
  uploadsCount: $("creator-uploads-count"),
  productsCount: $("creator-products-count"),
  balance: $("creator-balance"),
  revenue: $("creator-revenue"),

  enableBtn: $("creator-enable-btn"),
  refreshBtn: $("creator-refresh-btn"),
  profileBtn: $("creator-profile-btn"),
  uploadBtn: $("creator-upload-btn"),
  liveBtn: $("creator-live-btn"),
  storeBtn: $("creator-store-btn"),

  activityList: $("creator-activity-list"),
  empty: $("creator-empty")
};

const state = {
  user: null,
  profile: null,
  pageSettings: null,
  balance: null,
  channel: null,
  actionsBound: false
};

function getState() {
  return getCurrentUserState() || {};
}

function currentRole() {
  return state.profile?.role || "user";
}

function isCreatorEnabled() {
  return !!(
    state.profile?.is_creator ||
    state.profile?.is_artist ||
    state.profile?.is_seller ||
    [
      "creator",
      "artist",
      "seller",
      "admin",
      "owner",
      "super_admin",
      "founder",
      "rich_admin"
    ].includes(currentRole())
  );
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paintIdentity() {
  const current = getState();

  state.user = current.user || null;
  state.profile = current.profile || null;

  setText(els.name, profileName(state.profile));
  setText(els.handle, profileHandle(state.profile));
  setText(els.badge, profileBadge(state.profile));

  if (els.avatar) {
    const avatar = profileAvatar(state.profile);

    if (els.avatar.tagName === "IMG") {
      els.avatar.src = avatar;
      els.avatar.alt = profileName(state.profile);
    } else {
      els.avatar.style.backgroundImage = `url("${avatar}")`;
    }
  }

  setText(
    els.status,
    isCreatorEnabled()
      ? "Creator system connected."
      : "Creator mode available."
  );
}

async function countTable(table, match = {}) {
  if (!table) return 0;

  try {
    let query = supabase
      .from(table)
      .select("id", {
        count: "exact",
        head: true
      });

    Object.entries(match).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.warn(`[RB CREATOR COUNT WARNING] ${table}:`, error.message);
    return 0;
  }
}

async function loadCreatorSettings() {
  if (!state.user?.id) return null;

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.creatorPageSettings)
      .select("*")
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) throw error;

    state.pageSettings = data || null;
    return state.pageSettings;
  } catch (error) {
    console.warn("[RB CREATOR SETTINGS WARNING]", error.message);
    state.pageSettings = null;
    return null;
  }
}

async function ensureCreatorSettings() {
  if (!state.user?.id) return null;

  const existing = await loadCreatorSettings();
  if (existing?.id) return existing;

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.creatorPageSettings)
      .upsert(
        {
          user_id: state.user.id,
          display_name: profileName(state.profile),
          handle: profileHandle(state.profile),
          avatar_url: profileAvatar(state.profile),
          is_active: true,
          metadata: {
            source: "creator.js",
            app: "Rich Bizness Mobile"
          },
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "user_id"
        }
      )
      .select()
      .maybeSingle();

    if (error) throw error;

    state.pageSettings = data || null;
    return state.pageSettings;
  } catch (error) {
    console.warn("[RB CREATOR SETTINGS UPSERT WARNING]", error.message);
    return null;
  }
}

async function loadBalance() {
  if (!state.user?.id) return null;

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.creatorAvailableBalances)
      .select("*")
      .eq("artist_user_id", state.user.id)
      .maybeSingle();

    if (error) throw error;

    state.balance = data || null;

    setText(els.balance, money(data?.available_cents || 0));
    setText(els.revenue, money(data?.earned_cents || 0));

    return state.balance;
  } catch (error) {
    console.warn("[RB CREATOR BALANCE WARNING]", error.message);

    setText(els.balance, "$0.00");
    setText(els.revenue, "$0.00");

    return null;
  }
}

async function loadCreatorCounts() {
  if (!state.user?.id) return;

  setText(els.syncStatus, "Syncing creator dashboard...");

  const [
    posts,
    live,
    uploads,
    products
  ] = await Promise.all([
    countTable(RB_TABLES.feedPosts, { user_id: state.user.id }),
    countTable(RB_TABLES.liveStreams, { host_user_id: state.user.id }),
    countTable(RB_TABLES.uploads, { user_id: state.user.id }),
    countTable(RB_TABLES.products, { creator_id: state.user.id })
  ]);

  setText(els.postsCount, posts);
  setText(els.liveCount, live);
  setText(els.uploadsCount, uploads);
  setText(els.productsCount, products);

  setText(els.syncStatus, "Creator dashboard synced");
}

async function loadCreatorActivity() {
  if (!els.activityList || !state.user?.id) return;

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.feedPosts)
      .select("id, title, body, section, created_at")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;

    if (!data?.length) {
      els.activityList.innerHTML = "";
      if (els.empty) {
        els.empty.style.display = "block";
        els.empty.textContent = "No creator activity yet.";
      }
      return;
    }

    if (els.empty) els.empty.style.display = "none";

    els.activityList.innerHTML = data
      .map((item) => {
        return `
          <article class="rb-card rb-creator-card">
            <div class="rb-card-body">
              <span class="rb-card-kicker">${escapeHtml(item.section || "feed")}</span>
              <h3 class="rb-card-title">${escapeHtml(item.title || "Creator Post")}</h3>
              <p class="rb-card-copy">${escapeHtml(item.body || "Rich Bizness activity.")}</p>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.warn("[RB CREATOR ACTIVITY WARNING]", error.message);

    if (els.activityList) els.activityList.innerHTML = "";

    if (els.empty) {
      els.empty.style.display = "block";
      els.empty.textContent = "Creator activity waiting.";
    }
  }
}

async function enableCreatorMode() {
  if (!state.user?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  try {
    els.enableBtn.disabled = true;
    els.enableBtn.textContent = "Enabling...";

    await updateMyProfile({
      is_creator: true,
      role: currentRole() === "user" ? "creator" : currentRole()
    });

    await ensureCreatorSettings();
    await refreshProfileState();
    await refreshAppIdentity();

    paintIdentity();

    toastSuccess("Creator mode enabled.", "Rich Bizness");

    if (els.enableBtn) {
      els.enableBtn.textContent = "Creator Enabled";
    }
  } catch (error) {
    console.error("[RB CREATOR ENABLE FAILED]", error);
    toastError(error?.message || "Creator mode failed.");

    if (els.enableBtn) {
      els.enableBtn.disabled = false;
      els.enableBtn.textContent = "Enable Creator";
    }
  }
}

function clearRealtime() {
  if (state.channel) {
    supabase.removeChannel(state.channel);
    state.channel = null;
  }
}

function bindRealtime() {
  if (!state.user?.id) return;

  clearRealtime();

  state.channel = supabase
    .channel(`rb-creator-${state.user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles,
        filter: `id=eq.${state.user.id}`
      },
      async () => {
        await refreshProfileState();
        await refreshAppIdentity();
        paintIdentity();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.feedPosts,
        filter: `user_id=eq.${state.user.id}`
      },
      async () => {
        await loadCreatorCounts();
        await loadCreatorActivity();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.creatorAvailableBalances,
        filter: `artist_user_id=eq.${state.user.id}`
      },
      loadBalance
    )
    .subscribe();
}

function bindActions() {
  if (state.actionsBound) return;
  state.actionsBound = true;

  els.enableBtn?.addEventListener("click", enableCreatorMode);

  els.refreshBtn?.addEventListener("click", async () => {
    await loadCreatorCounts();
    await loadBalance();
    await loadCreatorActivity();
    toastInfo("Creator dashboard refreshed.", "Rich Bizness");
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  els.uploadBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.upload || "/upload";
  });

  els.liveBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.live || "/live";
  });

  els.storeBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.store || "/store";
  });

  window.addEventListener("beforeunload", clearRealtime);
}

async function bootCreatorPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    paintIdentity();
    bindActions();

    onProfileState((profileState) => {
      if (!profileState.ready) return;
      paintIdentity();
    });

    if (isCreatorEnabled()) {
      await ensureCreatorSettings();

      if (els.enableBtn) {
        els.enableBtn.textContent = "Creator Enabled";
        els.enableBtn.disabled = true;
      }
    }

    await loadCreatorCounts();
    await loadBalance();
    await loadCreatorActivity();

    bindRealtime();

    document.body.classList.add("rb-creator-ready");

    markPageReady("creator");

    console.log("RB CREATOR PAGE READY");
  } catch (error) {
    console.error("[RB CREATOR BOOT FAILED]", error);
    markPageError(error);
    toastError(error?.message || "Creator dashboard failed.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootCreatorPage);
} else {
  bootCreatorPage();
}
