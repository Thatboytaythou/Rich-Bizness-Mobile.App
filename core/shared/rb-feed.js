/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-feed.js

   GLOBAL FEED / POST ENGINE
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

const supabase = getSupabase();

function identity() {
  return getProfileIdentity?.() || {};
}

function cleanText(value = "") {
  return String(value || "").trim();
}

function mediaTypeFromUrl(url = "") {
  const value = String(url || "").toLowerCase();

  if (value.match(/\.(png|jpg|jpeg|webp|gif|avif)$/)) return "image";
  if (value.match(/\.(mp4|mov|webm|m4v)$/)) return "video";
  if (value.match(/\.(mp3|wav|ogg|m4a)$/)) return "audio";

  return "file";
}

export async function createFeedPost({
  body = "",
  mediaUrl = null,
  mediaType = null,
  thumbnailUrl = null,
  section = "feed",
  visibility = "public",
  metadata = {}
} = {}) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");

  const id = identity();

  const values = {
    user_id: user.id,
    username: id.username || null,
    display_name: id.display_name || null,
    body: cleanText(body),
    media_url: mediaUrl,
    media_type: mediaType || mediaTypeFromUrl(mediaUrl),
    thumbnail_url: thumbnailUrl,
    section,
    visibility,
    metadata: {
      source: "rb-feed.js",
      avatar_url: id.avatar_url || null,
      banner_url: id.banner_url || null,
      ...metadata
    }
  };

  const data = await rbInsert({
    table: RB_TABLES.feedPosts,
    values
  });

  return data?.[0] || null;
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

  const data = await rbUpdate({
    table: RB_TABLES.feedPosts,
    match: { id: postId },
    values: {
      ...values,
      updated_at: new Date().toISOString()
    }
  });

  return data?.[0] || null;
}

export async function deleteFeedPost(postId) {
  if (!postId) throw new Error("Missing post id.");

  const data = await rbDelete({
    table: RB_TABLES.feedPosts,
    match: { id: postId }
  });

  return data?.[0] || null;
}

export async function likeFeedPost(postId) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");
  if (!postId) throw new Error("Missing post id.");

  await supabase
    .from(RB_TABLES.feedPostLikes)
    .upsert(
      {
        post_id: postId,
        user_id: user.id
      },
      { onConflict: "post_id,user_id" }
    );

  const post = await getFeedPost(postId);

  await updateFeedPost(postId, {
    like_count: Number(post?.like_count || 0) + 1
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

export async function addFeedComment({
  postId,
  body,
  metadata = {}
}) {
  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");
  if (!postId) throw new Error("Missing post id.");

  const id = identity();

  const data = await rbInsert({
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

  const post = await getFeedPost(postId);

  await updateFeedPost(postId, {
    comment_count: Number(post?.comment_count || 0) + 1
  });

  return data?.[0] || null;
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

export async function recordFeedView(postId, sessionId = null) {
  const user = getUser();
  if (!postId) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.feedPostViews)
    .insert({
      post_id: postId,
      user_id: user?.id || null,
      session_id: sessionId || crypto.randomUUID()
    })
    .select()
    .maybeSingle();

  if (error) return null;

  const post = await getFeedPost(postId);

  await updateFeedPost(postId, {
    view_count: Number(post?.view_count || 0) + 1
  });

  return data || null;
}

export function buildFeedPostUrl(post = {}) {
  return `${RB_ROUTES.feed}?post=${encodeURIComponent(post.id)}`;
}

export function renderFeedPost(post = {}) {
  const media = post.media_url
    ? `<div class="rb-feed-media ${post.media_type || ""}" style="background-image:url('${post.thumbnail_url || post.media_url}')"></div>`
    : "";

  return `
    <article class="rb-feed-card" data-post-id="${post.id}">
      ${media}

      <div class="rb-feed-card-body">
        <div class="rb-feed-author">
          <strong>${post.display_name || post.username || "Rich User"}</strong>
          <span>${post.username ? "@" + post.username : "Rich Bizness"}</span>
        </div>

        <p>${post.body || ""}</p>

        <div class="rb-feed-actions">
          <button data-feed-like="${post.id}">🔥 ${Number(post.like_count || 0)}</button>
          <button data-feed-comments="${post.id}">💬 ${Number(post.comment_count || 0)}</button>
          <button data-feed-share="${post.id}">↗ Share</button>
        </div>
      </div>
    </article>
  `;
}

console.log("RB FEED READY");
