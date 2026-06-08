/* =========================
   RICH BIZNESS MOBILE
   /core/pages/admin.js

   ADMIN PAGE CONTROLLER
   Direct Supabase Admin Dashboard
   Profile Lock + Admin Role Check + Realtime

   Flow:
   - Reads current profile directly
   - Confirms admin through profiles.role OR admin_roles
   - Loads counts + audit logs
   - No profile-state dependency
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
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  profileName,
  profileAvatar,
  profileHandle,
  profileBadge,
  bindProfileShell
} from "/core/shared/rb-profile.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const els = {
  name: $("admin-user-name"),
  handle: $("admin-user-handle"),
  avatar: $("admin-user-avatar"),
  badge: $("admin-user-badge"),
  status: $("admin-status"),
  syncStatus: $("admin-sync-status"),

  usersCount: $("admin-users-count"),
  postsCount: $("admin-posts-count"),
  uploadsCount: $("admin-uploads-count"),
  reportsCount: $("admin-reports-count"),
  payoutsCount: $("admin-payouts-count"),
  liveCount: $("admin-live-count"),

  refreshBtn: $("admin-refresh-btn"),
  homeBtn: $("admin-home-btn"),
  profileBtn: $("admin-profile-btn"),

  auditList: $("admin-audit-list"),
  empty: $("admin-empty")
};

const state = {
  supabase: null,
  user: null,
  profile: null,
  adminRole: null,
  channel: null,
  actionsBound: false
};

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function safeImage(value = "", fallback = DEFAULT_AVATAR) {
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

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function syncStateFromApp() {
  const appState = getCurrentUserState?.() || {};

  state.user = appState.user || getUser?.() || state.user || null;
  state.profile = appState.profile || state.profile || null;
}

async function fetchMyProfile() {
  const user = getUser?.() || state.user;

  if (!user?.id) {
    state.user = null;
    state.profile = null;
    return null;
  }

  const { data, error } = await state.supabase
    .from(table("profiles", "profiles"))
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  state.user = user;
  state.profile = data || null;

  return state.profile;
}

async function fetchAdminRole() {
  if (!state.user?.id) {
    state.adminRole = null;
    return null;
  }

  const { data, error } = await state.supabase
    .from(table("adminRoles", "admin_roles"))
    .select("*")
    .eq("user_id", state.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[RB ADMIN ROLE WARNING]", error.message);
    state.adminRole = null;
    return null;
  }

  state.adminRole = data || null;
  return state.adminRole;
}

function isAdmin(profile = state.profile, adminRole = state.adminRole) {
  const role = profile?.role || "user";
  const roleKey = adminRole?.role_key || "";

  return [
    "admin",
    "owner",
    "super_admin",
    "founder",
    "rich_admin"
  ].includes(role) || [
    "founder",
    "rich_admin",
    "elite_mod",
    "support"
  ].includes(roleKey);
}

function paintIdentity() {
  const profile = state.profile || {};
  const name = profileName(profile);
  const avatar = safeImage(profileAvatar(profile), DEFAULT_AVATAR);

  setText(els.name, name);
  setText(els.handle, profileHandle(profile));
  setText(els.badge, state.adminRole?.role_label || profileBadge(profile));

  if (els.avatar) {
    if (els.avatar.tagName === "IMG") {
      els.avatar.src = avatar;
      els.avatar.alt = name;
    } else {
      els.avatar.style.backgroundImage = `url("${avatar}")`;
    }
  }

  setText(
    els.status,
    isAdmin()
      ? "Admin system connected."
      : "Admin access required."
  );

  bindProfileShell?.();
}

async function countTable(tableName, match = {}) {
  if (!tableName) return 0;

  try {
    let query = state.supabase
      .from(tableName)
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
    console.warn(`[RB ADMIN COUNT WARNING] ${tableName}:`, error.message);
    return 0;
  }
}

async function loadAdminCounts() {
  if (!isAdmin()) {
    setText(els.syncStatus, "Access blocked");
    return;
  }

  setText(els.syncStatus, "Syncing admin dashboard...");

  const [
    users,
    posts,
    uploads,
    reports,
    payouts,
    liveByCreator,
    liveByUser
  ] = await Promise.all([
    countTable(table("profiles", "profiles")),
    countTable(table("feedPosts", "feed_posts")),
    countTable(table("uploads", "uploads")),
    countTable(table("moderationReports", "moderation_reports")),
    countTable(table("payoutRequests", "payout_requests")),
    countTable(table("liveStreams", "live_streams"), { status: "live" }),
    countTable(table("liveStreams", "live_streams"), { status: "live" })
  ]);

  setText(els.usersCount, users);
  setText(els.postsCount, posts);
  setText(els.uploadsCount, uploads);
  setText(els.reportsCount, reports);
  setText(els.payoutsCount, payouts);
  setText(els.liveCount, liveByCreator || liveByUser || 0);

  setText(els.syncStatus, "Admin dashboard synced");
}

async function loadAuditLogs() {
  if (!els.auditList || !isAdmin()) return;

  try {
    const { data, error } = await state.supabase
      .from(table("adminAuditLogs", "admin_audit_logs"))
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data?.length) {
      els.auditList.innerHTML = "";

      if (els.empty) {
        els.empty.style.display = "block";
        els.empty.textContent = "Audit logs waiting.";
      }

      return;
    }

    if (els.empty) els.empty.style.display = "none";

    els.auditList.innerHTML = data
      .map((item) => {
        const title = item.action || item.event_type || "Admin Event";
        const body =
          item.description ||
          item.message ||
          item.target_table ||
          "System action logged.";

        const severity = item.severity || "normal";

        return `
          <article class="rb-card rb-admin-card" data-severity="${escapeHtml(severity)}">
            <div class="rb-card-body">
              <p class="rb-kicker">${escapeHtml(severity)}</p>
              <strong>${escapeHtml(title)}</strong>
              <p>${escapeHtml(body)}</p>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.warn("[RB ADMIN AUDIT WARNING]", error.message);

    if (els.auditList) {
      els.auditList.innerHTML = "";
    }

    if (els.empty) {
      els.empty.style.display = "block";
      els.empty.textContent = "Audit logs waiting.";
    }
  }
}

function clearRealtime() {
  if (state.channel && state.supabase) {
    state.supabase.removeChannel(state.channel);
    state.channel = null;
  }
}

function bindRealtime() {
  if (!state.user?.id || !isAdmin()) return;

  clearRealtime();

  state.channel = state.supabase
    .channel(`rb-admin-${state.user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("profiles", "profiles")
      },
      async () => {
        await fetchMyProfile();
        await fetchAdminRole();
        paintIdentity();
        await loadAdminCounts();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("adminRoles", "admin_roles"),
        filter: `user_id=eq.${state.user.id}`
      },
      async () => {
        await fetchAdminRole();
        paintIdentity();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("feedPosts", "feed_posts")
      },
      loadAdminCounts
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("uploads", "uploads")
      },
      loadAdminCounts
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("moderationReports", "moderation_reports")
      },
      loadAdminCounts
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("adminAuditLogs", "admin_audit_logs")
      },
      loadAuditLogs
    )
    .subscribe();
}

function bindActions() {
  if (state.actionsBound) return;
  state.actionsBound = true;

  els.refreshBtn?.addEventListener("click", async () => {
    await refreshAdmin();
    toastInfo("Admin dashboard refreshed.", "Rich Bizness");
  });

  els.homeBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.home || "/";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  window.addEventListener("beforeunload", clearRealtime);
}

async function refreshAdmin() {
  await refreshAppIdentity();
  syncStateFromApp();
  await fetchMyProfile();
  await fetchAdminRole();
  paintIdentity();
  await loadAdminCounts();
  await loadAuditLogs();
}

async function bootAdminPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false,
      ensureProfile: true
    });

    state.supabase = getSupabase();

    await ensureMyProfile();
    await refreshAdmin();

    if (!isAdmin()) {
      toastError("Admin access required.");
      window.location.href = RB_ROUTES.profile || "/profile";
      return;
    }

    bindActions();
    bindRealtime();

    document.body.dataset.rbPage = "admin";
    document.body.dataset.rbRoute = "admin";
    document.body.dataset.rbProfileLock = "true";
    document.body.classList.add("rb-admin-ready");

    markPageReady("admin");

    console.log("RB ADMIN PAGE READY");
  } catch (error) {
    console.error("[RB ADMIN BOOT FAILED]", error);
    markPageError(error);
    toastError(error?.message || "Admin failed to load.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAdminPage);
} else {
  bootAdminPage();
}
