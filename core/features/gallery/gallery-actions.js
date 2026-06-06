/* =========================
   RICH BIZNESS MOBILE
   /core/features/gallery/gallery-actions.js

   GALLERY ACTION ENGINE
   Load + upload route helpers + likes/views/delete
========================= */

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbInsert,
  rbUpdate,
  rbDelete
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  profileAvatar,
  profileName,
  profileHandle
} from "/core/shared/rb-profile.js";

import {
  createContentWithUpload
} from "/core/shared/rb-upload-router.js";

import {
  setGalleryLoading,
  setGalleryError,
  setGalleryItems,
  setMyGalleryItems,
  upsertGalleryItem,
  removeGalleryItem
} from "/core/features/gallery/gallery-state.js";

const supabase = getSupabase();

function safeText(value = "", fallback = "") {
  return String(value || fallback || "").trim();
}

function signInUrl() {
  return `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(
    window.location.pathname + window.location.search
  )}`;
}

function requireSignedIn() {
  const user = getUser();

  if (!user?.id) {
    window.location.href = signInUrl();
    throw new Error("Sign in required.");
  }

  return user;
}

function mediaTypeFromUrl(url = "") {
  const lower = String(url || "").toLowerCase();

  if (/\.(png|jpg|jpeg|webp|gif|avif)(\?|$)/.test(lower)) return "image";
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) return "audio";

  return "file";
}

function normalizeGalleryRow(row = {}) {
  const publicUrl =
    row.public_url ||
    row.media_url ||
    row.file_url ||
    row.image_url ||
    row.cover_url ||
    "";

  const mediaType =
    row.media_type ||
    row.type ||
    row.file_type ||
    row.metadata?.media_type ||
    mediaTypeFromUrl(publicUrl);

  return {
    ...row,
    public_url: publicUrl,
    media_url: row.media_url || publicUrl,
    cover_url:
      row.cover_url ||
      row.thumbnail_url ||
      row.image_url ||
      publicUrl,
    media_type: mediaType,
    section: row.section || "gallery",
    title:
      row.title ||
      row.name ||
      row.caption ||
      row.metadata?.title ||
      "Gallery Drop",
    description:
      row.description ||
      row.body ||
      row.caption ||
      row.metadata?.description ||
      ""
  };
}

function identityPayload(extra = {}) {
  const identity = getProfileIdentity?.() || {};
  const handle = profileHandle?.() || "";

  return {
    user_id: identity.user_id || identity.id || getUser()?.id || null,
    username: identity.username || handle.replace("@", "") || null,
    display_name: identity.display_name || profileName() || "Rich User",
    avatar_url: identity.avatar_url || profileAvatar() || null,
    ...extra
  };
}

async function safeSelectGallery({
  mine = false,
  userId = null,
  limit = 60
} = {}) {
  const attempts = [
    {
      name: "uploads_gallery_section",
      table: RB_TABLES.uploads,
      run: () => {
        let q = supabase
          .from(RB_TABLES.uploads)
          .select("*")
          .eq("section", "gallery")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (mine && userId) q = q.eq("user_id", userId);
        return q;
      }
    },
    {
      name: "uploads_gallery_category",
      table: RB_TABLES.uploads,
      run: () => {
        let q = supabase
          .from(RB_TABLES.uploads)
          .select("*")
          .eq("category", "gallery")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (mine && userId) q = q.eq("user_id", userId);
        return q;
      }
    },
    {
      name: "feed_posts_gallery",
      table: RB_TABLES.feedPosts,
      run: () => {
        let q = supabase
          .from(RB_TABLES.feedPosts)
          .select("*")
          .eq("section", "gallery")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (mine && userId) q = q.eq("user_id", userId);
        return q;
      }
    },
    {
      name: "uploads_no_filter",
      table: RB_TABLES.uploads,
      run: () => {
        let q = supabase
          .from(RB_TABLES.uploads)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (mine && userId) q = q.eq("user_id", userId);
        return q;
      }
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    if (!attempt.table) continue;

    try {
      const { data, error } = await attempt.run();
      if (error) throw error;

      return (data || []).map(normalizeGalleryRow);
    } catch (error) {
      lastError = error;
      console.warn(`[RB GALLERY SELECT SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  throw lastError || new Error("Gallery failed to load.");
}

export async function loadGalleryItems({
  limit = 60,
  includeMine = true
} = {}) {
  setGalleryLoading(true);

  try {
    const user = getUser();

    const [items, mine] = await Promise.all([
      safeSelectGallery({ limit }),
      includeMine && user?.id
        ? safeSelectGallery({
            mine: true,
            userId: user.id,
            limit
          })
        : Promise.resolve([])
    ]);

    setGalleryItems(items);
    setMyGalleryItems(mine);

    return {
      items,
      mine
    };
  } catch (error) {
    setGalleryError(error);
    throw error;
  }
}

export async function loadMyGalleryItems({
  limit = 60
} = {}) {
  const user = requireSignedIn();

  try {
    const mine = await safeSelectGallery({
      mine: true,
      userId: user.id,
      limit
    });

    setMyGalleryItems(mine);
    return mine;
  } catch (error) {
    setGalleryError(error);
    throw error;
  }
}

export async function createGalleryPost({
  title = "",
  description = "",
  mediaUrl = "",
  coverUrl = "",
  mediaType = "",
  category = "gallery",
  visibility = "public",
  metadata = {}
} = {}) {
  const user = requireSignedIn();
  const profile = await ensureMyProfile();

  const cleanMediaUrl = safeText(mediaUrl);

  if (!safeText(title) && !safeText(description) && !cleanMediaUrl) {
    throw new Error("Add a title, description, or media first.");
  }

  const payload = {
    ...identityPayload({
      user_id: user.id,
      username: profile?.username || identityPayload().username,
      display_name: profile?.display_name || profileName(profile),
      avatar_url: profile?.avatar_url || profileAvatar(profile)
    }),
    title: safeText(title, "Gallery Drop"),
    description: safeText(description),
    body: safeText(description),
    media_url: cleanMediaUrl || null,
    public_url: cleanMediaUrl || null,
    cover_url: safeText(coverUrl, cleanMediaUrl) || null,
    media_type: mediaType || mediaTypeFromUrl(cleanMediaUrl),
    section: "gallery",
    category: safeText(category, "gallery"),
    visibility: safeText(visibility, "public"),
    metadata: {
      source: "gallery-actions.js",
      app: "Rich Bizness Mobile",
      ...metadata
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  const row = normalizeGalleryRow(data || payload);
  upsertGalleryItem(row);

  return row;
}

export async function uploadGalleryMedia({
  file,
  title = "",
  description = "",
  category = "gallery",
  visibility = "public",
  metadata = {}
} = {}) {
  requireSignedIn();

  if (!file) {
    throw new Error("Choose a file first.");
  }

  const result = await createContentWithUpload({
    type: "galleryMedia",
    file,
    values: {
      ...identityPayload(),
      title: safeText(title, file.name || "Gallery Drop"),
      description: safeText(description),
      body: safeText(description),
      category: safeText(category, "gallery"),
      section: "gallery",
      visibility: safeText(visibility, "public")
    },
    metadata: {
      source: "gallery-actions.js",
      upload_type: "galleryMedia",
      ...metadata
    }
  });

  const uploadedUrl =
    result?.uploaded?.publicUrl ||
    result?.uploaded?.public_url ||
    result?.publicUrl ||
    result?.public_url ||
    result?.record?.public_url ||
    result?.record?.media_url ||
    "";

  let row = normalizeGalleryRow({
    ...(result?.record || {}),
    title: safeText(title, file.name || "Gallery Drop"),
    description,
    body: description,
    public_url: uploadedUrl,
    media_url: uploadedUrl,
    cover_url: uploadedUrl,
    media_type:
      result?.uploaded?.mediaType ||
      result?.uploaded?.media_type ||
      mediaTypeFromUrl(uploadedUrl),
    section: "gallery",
    category,
    visibility,
    metadata: {
      source: "gallery-actions.js",
      ...(metadata || {})
    }
  });

  if (!row.id && uploadedUrl) {
    try {
      row = await createGalleryPost({
        title: row.title,
        description: row.description,
        mediaUrl: uploadedUrl,
        coverUrl: uploadedUrl,
        mediaType: row.media_type,
        category,
        visibility,
        metadata: {
          upload_record: result?.record || null,
          ...metadata
        }
      });
    } catch (error) {
      console.warn("[RB GALLERY FEED MIRROR SKIPPED]", error?.message || error);
    }
  }

  if (row?.id) {
    upsertGalleryItem(row);
  }

  return {
    ...result,
    gallery: row
  };
}

export async function incrementGalleryView(item = {}) {
  if (!item?.id) return 0;

  const table =
    item.section === "gallery" && item.media_url
      ? RB_TABLES.feedPosts
      : RB_TABLES.uploads;

  const current = Number(item.view_count || item.views || 0);
  const next = current + 1;

  try {
    const rows = await rbUpdate({
      table,
      match: { id: item.id },
      values: {
        view_count: next,
        updated_at: new Date().toISOString()
      }
    });

    if (rows?.[0]) {
      upsertGalleryItem(normalizeGalleryRow(rows[0]));
    }

    return next;
  } catch (error) {
    console.warn("[RB GALLERY VIEW SKIPPED]", error?.message || error);
    return current;
  }
}

export async function toggleGalleryLike(item = {}) {
  const user = requireSignedIn();

  if (!item?.id) {
    throw new Error("Missing gallery item.");
  }

  const likeTable =
    RB_TABLES.feedPostLikes ||
    RB_TABLES.productLikes;

  if (!likeTable) {
    throw new Error("No like table configured.");
  }

  const isFeedPost = Boolean(item.media_url || item.section === "gallery");
  const matchColumn = isFeedPost ? "post_id" : "upload_id";

  try {
    const { data: existing } = await supabase
      .from(likeTable)
      .select("id")
      .eq(matchColumn, item.id)
      .eq("user_id", user.id)
      .maybeSingle();

    let liked = false;

    if (existing?.id) {
      await supabase
        .from(likeTable)
        .delete()
        .eq("id", existing.id);
    } else {
      const { error } = await supabase
        .from(likeTable)
        .insert({
          [matchColumn]: item.id,
          user_id: user.id
        });

      if (error) throw error;
      liked = true;
    }

    const { count } = await supabase
      .from(likeTable)
      .select("id", { count: "exact", head: true })
      .eq(matchColumn, item.id);

    const likeCount = count || 0;

    const table = isFeedPost ? RB_TABLES.feedPosts : RB_TABLES.uploads;

    const updated = await rbUpdate({
      table,
      match: { id: item.id },
      values: {
        like_count: likeCount,
        updated_at: new Date().toISOString()
      }
    });

    if (updated?.[0]) {
      upsertGalleryItem(normalizeGalleryRow(updated[0]));
    }

    return {
      liked,
      count: likeCount
    };
  } catch (error) {
    console.warn("[RB GALLERY LIKE FAILED]", error?.message || error);
    throw error;
  }
}

export async function deleteGalleryItem(item = {}) {
  const user = requireSignedIn();

  if (!item?.id) {
    throw new Error("Missing gallery item.");
  }

  const ownerId =
    item.user_id ||
    item.creator_id ||
    item.owner_id ||
    null;

  if (ownerId && ownerId !== user.id) {
    throw new Error("You can only delete your own gallery drops.");
  }

  const table =
    item.section === "gallery" && item.media_url
      ? RB_TABLES.feedPosts
      : RB_TABLES.uploads;

  await rbDelete({
    table,
    match: {
      id: item.id,
      user_id: user.id
    }
  });

  removeGalleryItem(item.id);

  return true;
}

export async function featureGalleryItem(item = {}, featured = true) {
  requireSignedIn();

  if (!item?.id) {
    throw new Error("Missing gallery item.");
  }

  const table =
    item.section === "gallery" && item.media_url
      ? RB_TABLES.feedPosts
      : RB_TABLES.uploads;

  const rows = await rbUpdate({
    table,
    match: { id: item.id },
    values: {
      is_featured: Boolean(featured),
      updated_at: new Date().toISOString()
    }
  });

  if (rows?.[0]) {
    upsertGalleryItem(normalizeGalleryRow(rows[0]));
  }

  return rows?.[0] || null;
}

export function openGalleryUpload() {
  window.location.href = `${RB_ROUTES.upload || "/upload"}?section=gallery`;
}

export function openGalleryProfile(item = {}) {
  const username = item.username || item.profile_username || "";
  const userId = item.user_id || item.creator_id || "";

  if (username) {
    window.location.href = `${RB_ROUTES.profile || "/profile"}?u=${encodeURIComponent(username)}`;
    return;
  }

  if (userId) {
    window.location.href = `${RB_ROUTES.profile || "/profile"}?id=${encodeURIComponent(userId)}`;
    return;
  }

  window.location.href = RB_ROUTES.profile || "/profile";
}

export function bindGalleryActionButtons({
  uploadSelector = "[data-gallery-upload]",
  refreshSelector = "[data-gallery-refresh]"
} = {}) {
  document.querySelectorAll(uploadSelector).forEach((button) => {
    if (button.dataset.rbGalleryUploadBound === "true") return;
    button.dataset.rbGalleryUploadBound = "true";

    button.addEventListener("click", openGalleryUpload);
  });

  document.querySelectorAll(refreshSelector).forEach((button) => {
    if (button.dataset.rbGalleryRefreshBound === "true") return;
    button.dataset.rbGalleryRefreshBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await loadGalleryItems();
      } finally {
        button.disabled = false;
      }
    });
  });
}

export function bootGalleryActions() {
  bindGalleryActionButtons();

  window.addEventListener("rb:gallery-refresh-request", async () => {
    await loadGalleryItems().catch((error) => {
      console.warn("[RB GALLERY REFRESH REQUEST FAILED]", error?.message || error);
    });
  });

  console.log("RB GALLERY ACTIONS READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGalleryActions);
} else {
  bootGalleryActions();
}
