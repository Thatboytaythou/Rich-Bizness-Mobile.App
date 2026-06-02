/* =========================
   RICH BIZNESS MOBILE
   /core/features/upload/upload-section-router.js

   UPLOAD SECTION ROUTER
   Routes storage uploads into app tables
========================= */

import {
  RB_TABLES,
  RB_BUCKETS
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbInsert,
  rbUpdate
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

const supabase = getSupabase();

export const UPLOAD_SECTION_ROUTES = Object.freeze({
  feed: {
    routeKey: "feedPost",
    section: "feed",
    bucket: RB_BUCKETS.generalUploads,
    table: RB_TABLES.feedPosts,
    column: "media_url",
    mode: "insert"
  },

  gallery: {
    routeKey: "galleryMedia",
    section: "gallery",
    bucket: RB_BUCKETS.galleryMedia,
    table: RB_TABLES.feedPosts,
    column: "media_url",
    mode: "insert"
  },

  music: {
    routeKey: "musicTrack",
    section: "music",
    bucket: RB_BUCKETS.musicAudio,
    table: RB_TABLES.musicTracks,
    column: "audio_url",
    mode: "insert"
  },

  podcast: {
    routeKey: "podcastAudio",
    section: "podcast",
    bucket: RB_BUCKETS.podcastAudio,
    table: RB_TABLES.podcastEpisodes,
    column: "audio_url",
    mode: "insert"
  },

  liveThumbnail: {
    routeKey: "liveThumbnail",
    section: "live",
    bucket: RB_BUCKETS.liveThumbnails,
    table: RB_TABLES.liveStreams,
    column: "thumbnail_url",
    mode: "attach"
  },

  liveRecording: {
    routeKey: "liveRecording",
    section: "live",
    bucket: RB_BUCKETS.liveRecordings,
    table: RB_TABLES.liveStreams,
    column: "recording_url",
    mode: "attach-private"
  },

  gaming: {
    routeKey: "gameClip",
    section: "gaming",
    bucket: RB_BUCKETS.gameClips,
    table: RB_TABLES.gameClips,
    column: "clip_url",
    mode: "insert"
  },

  sports: {
    routeKey: "sportsClip",
    section: "sports",
    bucket: RB_BUCKETS.sportsClips,
    table: RB_TABLES.sportsUploads,
    column: "file_url",
    mode: "insert"
  },

  storeProduct: {
    routeKey: "storeProduct",
    section: "store",
    bucket: RB_BUCKETS.storeProducts,
    table: RB_TABLES.products,
    column: "image_url",
    mode: "insert"
  },

  storeDigital: {
    routeKey: "storeDigital",
    section: "store",
    bucket: RB_BUCKETS.storeDigital,
    table: RB_TABLES.products,
    column: "digital_file_url",
    mode: "attach-private"
  },

  meta: {
    routeKey: "metaWorld",
    section: "meta",
    bucket: RB_BUCKETS.metaWorlds,
    table: RB_TABLES.metaWorlds,
    column: "world_url",
    mode: "insert"
  },

  profileAvatar: {
    routeKey: "profileAvatar",
    section: "profile",
    bucket: RB_BUCKETS.avatars,
    table: RB_TABLES.profiles,
    column: "avatar_url",
    mode: "update-profile"
  },

  profileBanner: {
    routeKey: "profileBanner",
    section: "profile",
    bucket: RB_BUCKETS.profileBanners,
    table: RB_TABLES.profiles,
    column: "banner_url",
    mode: "update-profile"
  }
});

export function getUploadSectionRoute(key = "feed") {
  return (
    UPLOAD_SECTION_ROUTES[key] ||
    UPLOAD_SECTION_ROUTES.feed
  );
}

export function listUploadSections() {
  return Object.keys(UPLOAD_SECTION_ROUTES);
}

function valueFromUpload(uploaded = {}, route = {}) {
  if (route.mode === "attach-private") {
    return uploaded.path || uploaded.file_path || "";
  }

  return (
    uploaded.publicUrl ||
    uploaded.public_url ||
    uploaded.url ||
    uploaded.path ||
    ""
  );
}

function baseMetadata({
  route,
  uploaded,
  values = {}
}) {
  return {
    app: "Rich Bizness Mobile",
    source: "upload-section-router.js",
    section: route.section,
    route_key: route.routeKey,
    bucket: uploaded.bucket,
    file_path: uploaded.path,
    public_url: uploaded.publicUrl || null,
    file_name: uploaded.fileName || null,
    file_size: uploaded.fileSize || null,
    mime_type: uploaded.mimeType || null,
    media_type: uploaded.mediaType || null,
    ...(values.metadata || {})
  };
}

async function insertUploadLedger({
  route,
  uploaded,
  values = {}
}) {
  const user = getUser();
  if (!user?.id || !RB_TABLES.uploads) return null;

  const identity = getProfileIdentity();

  const payload = {
    user_id: user.id,
    title: values.title || uploaded.fileName || null,
    description: values.description || values.body || null,
    category: values.category || route.section,
    section: route.section,
    bucket: uploaded.bucket,
    file_path: uploaded.path,
    public_url: uploaded.publicUrl || null,
    mime_type: uploaded.mimeType || "",
    file_size: uploaded.fileSize || 0,
    media_type: uploaded.mediaType || "file",
    visibility: values.visibility || "public",
    processing_status: "completed",
    metadata: {
      ...baseMetadata({ route, uploaded, values }),
      username: identity.username,
      display_name: identity.display_name,
      avatar_url: identity.avatar_url
    }
  };

  try {
    const data = await rbInsert({
      table: RB_TABLES.uploads,
      values: payload
    });

    return data?.[0] || null;
  } catch (error) {
    console.warn("[RB UPLOAD LEDGER SKIPPED]", error?.message || error);
    return null;
  }
}

export async function routeUploadedFile({
  section = "feed",
  uploaded,
  values = {},
  match = {}
} = {}) {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  if (!uploaded) {
    throw new Error("Missing uploaded file result.");
  }

  const route = getUploadSectionRoute(section);
  const identity = getProfileIdentity();
  const fileValue = valueFromUpload(uploaded, route);

  if (!fileValue) {
    throw new Error("Upload finished but no file URL/path was returned.");
  }

  const uploadRecord = await insertUploadLedger({
    route,
    uploaded,
    values
  });

  if (route.mode === "update-profile") {
    const data = await rbUpdate({
      table: route.table,
      match: { id: user.id },
      values: {
        [route.column]: fileValue,
        updated_at: new Date().toISOString()
      }
    });

    return {
      route,
      upload: uploadRecord,
      record: data?.[0] || null
    };
  }

  if (route.mode === "attach" || route.mode === "attach-private") {
    const finalMatch = Object.keys(match || {}).length
      ? match
      : values.id
        ? { id: values.id }
        : null;

    if (!finalMatch) {
      return {
        route,
        upload: uploadRecord,
        record: null,
        needsTarget: true
      };
    }

    const data = await rbUpdate({
      table: route.table,
      match: finalMatch,
      values: {
        [route.column]: fileValue,
        updated_at: new Date().toISOString()
      }
    });

    return {
      route,
      upload: uploadRecord,
      record: data?.[0] || null
    };
  }

  const payload = buildTargetPayload({
    route,
    uploaded,
    fileValue,
    values,
    identity,
    userId: user.id
  });

  const data = await rbInsert({
    table: route.table,
    values: payload
  });

  return {
    route,
    upload: uploadRecord,
    record: data?.[0] || null
  };
}

function buildTargetPayload({
  route,
  uploaded,
  fileValue,
  values,
  identity,
  userId
}) {
  const common = {
    user_id: values.user_id || userId,
    username: values.username || identity.username,
    display_name: values.display_name || identity.display_name,
    title: values.title || uploaded.fileName || "Rich Bizness Upload",
    description: values.description || values.body || null,
    [route.column]: fileValue,
    metadata: baseMetadata({
      route,
      uploaded,
      values
    })
  };

  if (route.table === RB_TABLES.feedPosts) {
    return {
      user_id: userId,
      username: identity.username,
      display_name: identity.display_name,
      body: values.body || values.description || null,
      media_url: fileValue,
      media_type: uploaded.mediaType || values.media_type || "image",
      thumbnail_url: values.thumbnail_url || null,
      section: route.section,
      visibility: values.visibility || "public",
      like_count: 0,
      comment_count: 0,
      repost_count: 0,
      view_count: 0,
      metadata: common.metadata
    };
  }

  if (route.table === RB_TABLES.musicTracks) {
    return {
      user_id: userId,
      creator_id: userId,
      title: values.title || uploaded.fileName || "Untitled Track",
      artist_name: identity.display_name,
      description: values.description || null,
      genre: values.genre || values.category || "Rich Bizness",
      audio_url: fileValue,
      cover_url: values.cover_url || null,
      is_published: true,
      metadata: common.metadata
    };
  }

  if (route.table === RB_TABLES.podcastEpisodes) {
    return {
      user_id: userId,
      creator_id: userId,
      show_id: values.show_id || null,
      title: values.title || uploaded.fileName || "Untitled Episode",
      description: values.description || null,
      audio_url: fileValue,
      cover_url: values.cover_url || null,
      episode_number: values.episode_number || null,
      is_published: true,
      metadata: common.metadata
    };
  }

  if (route.table === RB_TABLES.gameClips) {
    return {
      user_id: userId,
      title: values.title || uploaded.fileName || "Game Clip",
      game_slug: values.game_slug || values.game || null,
      clip_url: fileValue,
      thumbnail_url: values.thumbnail_url || null,
      metadata: common.metadata
    };
  }

  if (route.table === RB_TABLES.sportsUploads) {
    return {
      user_id: userId,
      title: values.title || uploaded.fileName || "Sports Upload",
      caption: values.description || values.body || null,
      sport_name: values.sport_name || values.category || null,
      content_type: uploaded.mediaType || "video",
      file_url: fileValue,
      thumbnail_url: values.thumbnail_url || null,
      views: 0,
      likes: 0,
      is_featured: false,
      metadata: common.metadata
    };
  }

  if (route.table === RB_TABLES.products) {
    return {
      seller_id: userId,
      user_id: userId,
      title: values.title || uploaded.fileName || "Rich Bizness Product",
      description: values.description || null,
      price_cents: Number(values.price_cents || 0),
      currency: values.currency || "usd",
      image_url: fileValue,
      product_type: values.product_type || "physical",
      status: "active",
      is_public: true,
      metadata: common.metadata
    };
  }

  if (route.table === RB_TABLES.metaWorlds) {
    return {
      user_id: userId,
      creator_id: userId,
      title: values.title || uploaded.fileName || "Meta World",
      description: values.description || null,
      world_url: fileValue,
      visibility: values.visibility || "public",
      metadata: common.metadata
    };
  }

  return common;
}

console.log("RB UPLOAD SECTION ROUTER READY");
