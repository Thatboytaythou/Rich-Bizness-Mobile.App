/* =========================
   RICH BIZNESS MOBILE
   /core/pages/admin.js

   ADMIN PAGE CONTROLLER
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
  profileName,
  profileAvatar,
  profileHandle,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

const supabase = getSupabase();

const $ = (id) => document.getElementById(id);

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
  profile: null,
  user: null,
  channel: null,
  actionsBound: false
};

function getState() {
  return getCurrentUserState() || {};
}

function isAdmin(profile = state.profile) {
  const role = profile?.role || "user";

  return [
    "admin",
    "owner",
    "super_admin",
    "founder",
    "rich_admin"
  ].includes(role);
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function paintIdentity() {
  const current = getState();

  state.user = current.user || null;
  state.profile = current.profile || null;

  if (els.name) els.name.textContent = profileName(state.profile);
  if (els.handle) els.handle.textContent = profileHandle(state.profile);
  if (els.badge) els.badge.textContent = profileBadge(state.profile);

  if (els.avatar) {
    const avatar = profileAvatar(state.profile);

    if (els.avatar.tagName === "IMG") {
      els.avatar.src = avatar;
      els.avatar.alt = profileName(state.profile);
    } else {
      els.avatar.style.backgroundImage = `url("${avatar}")`;
    }
  }

  if (els.status) {
    els.status.textContent = isAdmin()
      ? "Admin system connected."
      : "Admin access required.";
  }
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
    console.warn(`[RB ADMIN COUNT WARNING] ${table}:`, error.message);
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
    live
  ] = await Promise.all([
    countTable(RB_TABLES.profiles),
    countTable(RB_TABLES.feedPosts),
    countTable(RB_TABLES.uploads),
    countTable(RB_TABLES.moderationReports),
    countTable(RB_TABLES.payoutRequests || "payout_requests"),
    countTable(RB_TABLES.liveStreams, { status: "live" })
  ]);

  setText(els.usersCount, users);
  setText(els.postsCount, posts);
  setText(els.uploadsCount, uploads);
  setText(els.reportsCount, reports);
  setText(els.payoutsCount, payouts);
  setText(els.liveCount, live);

  setText(els.syncStatus, "Admin dashboard synced");
}

async function loadAuditLogs() {
  if (!els.auditList || !isAdmin()) return;

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.adminAuditLogs)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data?.length) {
      els.auditList.innerHTML = "";
      if (els.empty) els.empty.style.display = "block";
      return;
    }

    if (els.empty) els.empty.style.display = "none";

    els.auditList.innerHTML = data
      .map((item) => {
        const title = item.action || item.event_type || "Admin Event";
        const body = item.description || item.message || item.table_name || "System action logged.";

        return `
          <article class="rb-card rb-admin-card">
            <div class="rb-card-body">
              <strong>${String(title)}</strong>
              <p>${String(body)}</p>
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
  if (state.channel) {
    supabase.removeChannel(state.channel);
    state.channel = null;
  }
}

function bindRealtime() {
  if (!state.user?.id || !isAdmin()) return;

  clearRealtime();

  state.channel = supabase
    .channel(`rb-admin-${state.user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles
      },
      loadAdminCounts
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.feedPosts
      },
      loadAdminCounts
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.uploads
      },
      loadAdminCounts
    )
    .subscribe();
}

function bindActions() {
  if (state.actionsBound) return;
  state.actionsBound = true;

  els.refreshBtn?.addEventListener("click", async () => {
    await loadAdminCounts();
    await loadAuditLogs();
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

async function bootAdminPage() {
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

    if (!isAdmin()) {
      toastError("Admin access required.");
      window.location.href = RB_ROUTES.profile || "/profile";
      return;
    }

    bindActions();

    onProfileState((profileState) => {
      if (!profileState.ready) return;
      paintIdentity();
    });

    await loadAdminCounts();
    await loadAuditLogs();

    bindRealtime();

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
