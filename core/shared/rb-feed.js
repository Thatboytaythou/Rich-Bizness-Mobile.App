/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-feed.js

   GLOBAL FEED / POST ENGINE

   Locked purpose:
   - create feed posts
   - load feed posts
   - like/unlike posts
   - add comments
   - record views
   - route feed actions through rb-action-engine.js
========================= */

import {
  RB_ROUTES,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfileIdentity,
  rbInsert,
  rbUpdate,
  rbDelete
} from "/core/shared/rb-supabase.js";

import {
  runRichAction,
  actionFeedPostCreated
} from "/core/shared/rb-action-engine.js";

const supabase = getSupabase();

function identity() {
  return getProfileIdentity?.() || {};
}

function firstRow(result) {
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result?.data)) return result.data[0] || null;
  return result || null;
}

function cleanText(value = "") {
  return String(value || "").trim();
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value = "") {
  const src = String(value || "").trim();

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return "";
}

function mediaTypeFromUrl(url = "") {
  const value = String(url || "").toLowerCase();

  if (value.match(/\.(png|jpg|jpeg|webp|gif|avif)(\?|$)/)) return "image";
  if (value.match(/\.(mp4|mov|webm|m4v)(\?|$)/)) return "video";
  if (value.match(/\.(mp3|wav|ogg|m4a)(\?|$)/)) return "audio";

  return url ? "file" : null;
}

async function safeAction(payload = {}) {
  try {
    return await runRichAction(payload);
  } catch (error) {
    console.warn("[RB FEED ACTION SKIPPED]", error?.message || error);
    return null;
  }
}

async function safePostActionCreated(post, metadata = {}) {
  try {
    return await actionFeedPostCreated({
      postId: post?.id || null,
      title: post?.body || "Feed post created",
      metadata: {
        section: post?.section || "feed",
        visibility: post?.visibility || "public",
        media_type: post?.media_type || null,
        ...metadata
      }
    });
  } catch (error) {
    console.warn("[RB FEED POST ACTION SKIPPED]", error?.message || error);
    return null;
  }
}

/* =========================
   CREATE / LOAD
========================= */

export async function createFeedPost({
  body = "",
  mediaUrl = null,
  mediaType = null,
  thumbnailUrl = null,
  section = "feed",
  visibility = "public",
  metadata = {},
  award = true
} = {}) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");

  const id = identity();

  const values = {
    user_id: user.id,
    username: id.username || null,
    display_name: id.display_name || null,
    body: cleanText(body),
    media_url: safeUrl(mediaUrl) || null,
    media_type: mediaType || mediaTypeFromUrl(mediaUrl),
    thumbnail_url: safeUrl(thumbnailUrl) || null,
    section,
    visibility,
    metadata: {
      source: "rb-feed.js",
      avatar_url: id.avatar_url || null,
      banner_url: id.banner_url || null,
      ...metadata
    }
  };

  const rows = await rbInsert({
    table: RB_TABLES.feedPosts,
    values
  });

  const post = firstRow(rows);

  if (award && post?.id) {
    await safePostActionCreated(post, metadata);
  }

  return post;
}

export async function loadFeedPosts({
  section = null,
  userId = null,
  limit = 30
} = {}) {
  let query = supabase
    .from(RB_TABLES.feedPosts)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (section) query = query.eq("section", section);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function getFeedPost(postId) {
  if (!postId) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function updateFeedPost(postId, values = {}) {
  if (!postId) throw new Error("Missing post id.");

  const rows = await rbUpdate({
    table: RB_TABLES.feedPosts,
    match: { id: postId },
    values: {
      ...values,
      updated_at: new Date().toISOString()
    }
  });

  return firstRow(rows);
}

export async function deleteFeedPost(postId) {
  if (!postId) throw new Error("Missing post id.");

  const rows = await rbDelete({
    table: RB_TABLES.feedPosts,
    match: { id: postId }
  });

  return firstRow(rows);
}

/* =========================
   LIKES
========================= */

export async function likeFeedPost(postId) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");
  if (!postId) throw new Error("Missing post id.");

  const { data: likeRow, error: likeError } = await supabase
    .from(RB_TABLES.feedPostLikes)
    .upsert(
      {
        post_id: postId,
        user_id: user.id,
        created_at: new Date().toISOString()
      },
      { onConflict: "post_id,user_id" }
    )
    .select("*")
    .maybeSingle();

  if (likeError) throw likeError;

  const post = await getFeedPost(postId);

  await updateFeedPost(postId, {
    like_count: Number(post?.like_count || 0) + 1
  });

  await safeAction({
    action: "like_created",
    section: post?.section || "feed",
    targetTable: RB_TABLES.feedPostLikes,
    targetType: "feed_like",
    targetId: likeRow?.id || postId,
    targetUrl: buildFeedPostUrl(post || { id: postId }),
    title: "Post liked",
    emoji: "🔥",
    metadata: {
      post_id: postId,
      post_owner_id: post?.user_id || null
    }
  });

  return true;
}

export async function unlikeFeedPost(postId) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");
  if (!postId) throw new Error("Missing post id.");

  await supabase
    .from(RB_TABLES.feedPostLikes)
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);

  const post = await getFeedPost(postId);

  await updateFeedPost(postId, {
    like_count: Math.max(0, Number(post?.like_count || 0) - 1)
  });

  return true;
}

/* =========================
   COMMENTS
========================= */

export async function addFeedComment({
  postId,
  body,
  metadata = {}
}) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");
  if (!postId) throw new Error("Missing post id.");

  const id = identity();

  const rows = await rbInsert({
    table: RB_TABLES.feedComments,
    values: {
      post_id: postId,
      user_id: user.id,
      username: id.username || null,
      display_name: id.display_name || null,
      body: cleanText(body),
      metadata: {
        source: "rb-feed.js",
        avatar_url: id.avatar_url || null,
        ...metadata
      }
    }
  });

  const comment = firstRow(rows);
  const post = await getFeedPost(postId);

  await updateFeedPost(postId, {
    comment_count: Number(post?.comment_count || 0) + 1
  });

  await safeAction({
    action: "comment_created",
    section: post?.section || "feed",
    targetTable: RB_TABLES.feedComments,
    targetType: "feed_comment",
    targetId: comment?.id || postId,
    targetUrl: buildFeedPostUrl(post || { id: postId }),
    title: "Comment added",
    body: cleanText(body),
    emoji: "💬",
    metadata: {
      post_id: postId,
      post_owner_id: post?.user_id || null,
      ...metadata
    }
  });

  return comment;
}

export async function loadFeedComments(postId, limit = 50) {
  if (!postId) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.feedComments)
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/* =========================
   VIEWS
========================= */

export async function recordFeedView(postId, sessionId = null) {
  const user = getUser();
  if (!postId) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.feedPostViews)
    .insert({
      post_id: postId,
      user_id: user?.id || null,
      session_id: sessionId || crypto.randomUUID(),
      created_at: new Date().toISOString()
    })
    .select()
    .maybeSingle();

  if (error) return null;

  const post = await getFeedPost(postId);

  await updateFeedPost(postId, {
    view_count: Number(post?.view_count || 0) + 1
  });

  if (user?.id) {
    await safeAction({
      action: "feed_post_viewed",
      section: post?.section || "feed",
      targetTable: RB_TABLES.feedPostViews,
      targetType: "feed_view",
      targetId: data?.id || postId,
      targetUrl: buildFeedPostUrl(post || { id: postId }),
      title: "Post viewed",
      emoji: "👁️",
      metadata: {
        post_id: postId,
        post_owner_id: post?.user_id || null
      }
    });
  }

  return data || null;
}

/* =========================
   URL / RENDER
========================= */

export function buildFeedPostUrl(post = {}) {
  const id = post?.id || "";
  return `${RB_ROUTES.feed}?post=${encodeURIComponent(id)}`;
}

export function renderFeedPost(post = {}) {
  const image = safeUrl(post.thumbnail_url || post.media_url || "");
  const media = image
    ? `<div class="rb-feed-media ${escapeHtml(post.media_type || "")}" style="background-image:url('${escapeHtml(image)}')"></div>`
    : "";

  return `
    <article class="rb-feed-card" data-post-id="${escapeHtml(post.id || "")}">
      ${media}

      <div class="rb-feed-card-body">
        <div class="rb-feed-author">
          <strong>${escapeHtml(post.display_name || post.username || "Rich User")}</strong>
          <span>${post.username ? "@" + escapeHtml(post.username) : "Rich Bizness"}</span>
        </div>

        <p>${escapeHtml(post.body || "")}</p>

        <div class="rb-feed-actions">
          <button data-feed-like="${escapeHtml(post.id || "")}">🔥 ${Number(post.like_count || 0)}</button>
          <button data-feed-comments="${escapeHtml(post.id || "")}">💬 ${Number(post.comment_count || 0)}</button>
          <button data-feed-share="${escapeHtml(post.id || "")}">↗ Share</button>
        </div>
      </div>
    </article>
  `;
}

console.log("RB FEED READY");
