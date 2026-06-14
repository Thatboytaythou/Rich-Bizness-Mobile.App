/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-upload-router.js

   MASTER UPLOAD ROUTER
   Buckets + Tables + Columns Locked
   Uses rb-storage.js + rb-supabase.js
   Routes completed uploads into rb-action-engine.js
========================= */

import {
  RB_BUCKETS,
  RB_TABLES,
  RB_UPLOAD_ROUTES as CONFIG_UPLOAD_ROUTES
} from "/core/shared/rb-config.js";

import {
  rbUpload,
  detectMediaType
} from "/core/shared/rb-storage.js";

import {
  getUser,
  getProfileIdentity,
  rbInsert,
  rbUpdate,
  rbUpsert
} from "/core/shared/rb-supabase.js";

import {
  runRichAction,
  actionFeedPostCreated,
  actionMusicUploaded,
  actionGameScoreSubmitted,
  actionSportsUploadCreated,
  actionProductCreated
} from "/core/shared/rb-action-engine.js";

const PRIVATE_BUCKETS = new Set([
  RB_BUCKETS.storeDigital,
  RB_BUCKETS.liveRecordings
]);

export const RB_UPLOAD_ROUTES = Object.freeze({
  profileAvatar: {
    bucket: RB_BUCKETS.avatars,
    folder: "avatars",
    section: "profile",
    visibility: "public",
    table: RB_TABLES.profiles,
    column: "avatar_url",
    mode: "update-profile",
    action: "profile_avatar_updated"
  },

  profileBanner: {
    bucket: RB_BUCKETS.profileBanners,
    folder: "banners",
    section: "profile",
    visibility: "public",
    table: RB_TABLES.profiles,
    column: "banner_url",
    mode: "update-profile",
    action: "profile_banner_updated"
  },

  metaAvatar: {
    bucket: RB_BUCKETS.metaAvatars,
    folder: "avatars",
    section: "meta",
    visibility: "public",
    table: RB_TABLES.metaAvatars,
    column: "avatar_url",
    mode: "upsert-user",
    action: "meta_avatar_updated"
  },

  metaWorld: {
    bucket: RB_BUCKETS.metaWorlds,
    folder: "worlds",
    section: "meta",
    visibility: "public",
    table: RB_TABLES.metaWorlds,
    column: "cover_url",
    mode: "insert",
    action: "meta_world_created"
  },

  feedPost: {
    bucket: RB_BUCKETS.generalUploads,
    folder: "feed",
    section: "feed",
    visibility: "public",
    table: RB_TABLES.feedPosts,
    column: "media_url",
    mode: "insert",
    action: "feed_post_created"
  },

  galleryMedia: {
    bucket: RB_BUCKETS.galleryMedia,
    folder: "gallery",
    section: "gallery",
    visibility: "public",
    table: RB_TABLES.uploads,
    column: "public_url",
    mode: "upload-only",
    action: "upload_created"
  },

  musicTrack: {
    bucket: RB_BUCKETS.musicAudio,
    folder: "tracks",
    section: "music",
    visibility: "public",
    table: RB_TABLES.musicTracks,
    column: "audio_url",
    mode: "insert",
    action: "music_uploaded"
  },

  musicCover: {
    bucket: RB_BUCKETS.musicCovers,
    folder: "covers",
    section: "music",
    visibility: "public",
    table: RB_TABLES.musicTracks,
    column: "cover_url",
    mode: "attach",
    action: "upload_created"
  },

  podcastAudio: {
    bucket: RB_BUCKETS.podcastAudio,
    folder: "episodes",
    section: "podcast",
    visibility: "public",
    table: RB_TABLES.podcastEpisodes,
    column: "audio_url",
    mode: "insert",
    action: "podcast_uploaded"
  },

  podcastCover: {
    bucket: RB_BUCKETS.podcastCovers,
    folder: "covers",
    section: "podcast",
    visibility: "public",
    table: RB_TABLES.podcastEpisodes,
    column: "cover_url",
    mode: "attach",
    action: "upload_created"
  },

  radioCover: {
    bucket: RB_BUCKETS.radioCovers,
    folder: "radio",
    section: "radio",
    visibility: "public",
    table: RB_TABLES.radioStations,
    column: "cover_url",
    mode: "attach",
    action: "upload_created"
  },

  liveThumbnail: {
    bucket: RB_BUCKETS.liveThumbnails,
    folder: "thumbnails",
    section: "live",
    visibility: "public",
    table: RB_TABLES.liveStreams,
    column: "thumbnail_url",
    mode: "attach",
    action: "upload_created"
  },

  liveRecording: {
    bucket: RB_BUCKETS.liveRecordings,
    folder: "recordings",
    section: "live",
    visibility: "private",
    table: RB_TABLES.liveStreams,
    column: "recording_url",
    mode: "attach",
    action: "upload_created"
  },

  gameAsset: {
    bucket: RB_BUCKETS.gameAssets,
    folder: "assets",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.games,
    column: "play_url",
    mode: "attach",
    action: "upload_created"
  },

  gameClip: {
    bucket: RB_BUCKETS.gameClips,
    folder: "clips",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.gameClips,
    column: "clip_url",
    mode: "insert",
    action: "game_clip_uploaded"
  },

  gameCover: {
    bucket: RB_BUCKETS.gameCovers,
    folder: "covers",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.games,
    column: "cover_url",
    mode: "attach",
    action: "upload_created"
  },

  sportsMedia: {
    bucket: RB_BUCKETS.sportsMedia,
    folder: "media",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsUploads,
    column: "file_url",
    mode: "insert",
    action: "sports_upload_created"
  },

  sportsClip: {
    bucket: RB_BUCKETS.sportsClips,
    folder: "clips",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsUploads,
    column: "file_url",
    mode: "insert",
    action: "sports_upload_created"
  },

  sportsCover: {
    bucket: RB_BUCKETS.sportsCovers,
    folder: "covers",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsPosts,
    column: "cover_url",
    mode: "attach",
    action: "upload_created"
  },

  storeProduct: {
    bucket: RB_BUCKETS.storeProducts,
    folder: "products",
    section: "store",
    visibility: "public",
    table: RB_TABLES.products,
    column: "image_url",
    mode: "insert",
    action: "product_created"
  },

  storeSellerMedia: {
    bucket: RB_BUCKETS.storeSellerMedia,
    folder: "seller",
    section: "store",
    visibility: "public",
    table: RB_TABLES.storeSellerProfiles,
    column: "banner_url",
    mode: "upsert-user",
    action: "upload_created"
  },

  storeDigital: {
    bucket: RB_BUCKETS.storeDigital,
    folder: "digital",
    section: "store",
    visibility: "private",
    table: RB_TABLES.products,
    column: "digital_file_url",
    mode: "attach",
    action: "upload_created"
  }
});

function now() {
  return new Date().toISOString();
}

function firstRow(result) {
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result?.data)) return result.data[0] || null;
  return result || null;
}

function routeFromConfig(type) {
  const route = CONFIG_UPLOAD_ROUTES?.[type];
  if (!route) return null;

  return {
    bucket: route.bucket,
    folder: type,
    section: route.feedSection || route.section || type,
    visibility: PRIVATE_BUCKETS.has(route.bucket) ? "private" : "public",
    table: route.table,
    column: route.column,
    mode: "attach",
    action: "upload_created"
  };
}

export function getUploadRoute(type) {
  const route = RB_UPLOAD_ROUTES[type] || routeFromConfig(type);

  if (!route) {
    throw new Error(`Unknown upload route: ${type}`);
  }

  return route;
}

export function listUploadRoutes() {
  return Object.keys(RB_UPLOAD_ROUTES);
}

export function listUploadRoutesBySection(section) {
  return Object.entries(RB_UPLOAD_ROUTES)
    .filter(([, route]) => route.section === section)
    .map(([key, route]) => ({
      key,
      ...route
    }));
}

function uploadedValue(uploaded, route) {
  if (route.visibility === "public") {
    return (
      uploaded?.publicUrl ||
      uploaded?.public_url ||
      uploaded?.url ||
      uploaded?.upload?.public_url ||
      uploaded?.upload?.publicUrl ||
      ""
    );
  }

  return (
    uploaded?.path ||
    uploaded?.file_path ||
    uploaded?.upload?.path ||
    uploaded?.upload?.file_path ||
    ""
  );
}

function cleanMetadata(metadata = {}) {
  return {
    source: "rb-upload-router.js",
    ...metadata
  };
}

function identityPayload(extra = {}) {
  const user = getUser();
  const identity = getProfileIdentity?.() || {};
  const userId = user?.id || identity?.user_id || identity?.id || null;

  return {
    user_id: userId,
    username: identity?.username || null,
    display_name: identity?.display_name || null,
    avatar_url: identity?.avatar_url || null,
    ...extra
  };
}

function insertPayload({ route, values, urlValue, metadata, mediaType }) {
  return {
    ...identityPayload(),
    ...values,
    section: values.section || route.section,
    visibility: values.visibility || route.visibility || "public",
    media_type: values.media_type || mediaType || null,
    [route.column]: urlValue,
    metadata: {
      ...cleanMetadata(metadata),
      ...(values.metadata || {})
    },
    created_at: values.created_at || now(),
    updated_at: now()
  };
}

async function dispatchUploadAction({
  type,
  route,
  record = null,
  uploaded = null,
  urlValue = "",
  values = {},
  metadata = {}
} = {}) {
  const recordId = record?.id || values?.id || uploaded?.id || uploaded?.path || null;
  const title =
    values?.title ||
    values?.name ||
    values?.caption ||
    metadata?.title ||
    `${route.section} upload`;

  const actionMetadata = {
    upload_type: type,
    upload_bucket: route.bucket,
    upload_path: uploaded?.path || uploaded?.file_path || null,
    url: urlValue,
    media_type: uploaded?.mediaType || uploaded?.media_type || values?.media_type || null,
    ...metadata
  };

  try {
    if (route.action === "feed_post_created") {
      return await actionFeedPostCreated({
        postId: recordId,
        title,
        metadata: actionMetadata
      });
    }

    if (route.action === "music_uploaded") {
      return await actionMusicUploaded({
        trackId: recordId,
        title,
        metadata: actionMetadata
      });
    }

    if (route.action === "game_score_submitted") {
      return await actionGameScoreSubmitted({
        scoreId: recordId,
        title,
        metadata: actionMetadata
      });
    }

    if (route.action === "sports_upload_created") {
      return await actionSportsUploadCreated({
        uploadId: recordId,
        title,
        metadata: actionMetadata
      });
    }

    if (route.action === "product_created") {
      return await actionProductCreated({
        productId: recordId,
        title,
        metadata: actionMetadata
      });
    }

    return await runRichAction({
      action: route.action || "upload_created",
      section: route.section || "upload",
      targetTable: route.table,
      targetType: type,
      targetId: recordId,
      title,
      emoji: "⬆️",
      metadata: actionMetadata
    });
  } catch (error) {
    console.warn("[RB UPLOAD ACTION SKIPPED]", error?.message || error);
    return null;
  }
}

export async function uploadByRoute({
  type,
  file,
  metadata = {},
  upsert = false
}) {
  if (!file) {
    throw new Error("Missing upload file.");
  }

  const route = getUploadRoute(type);
  const mediaType = detectMediaType(file);

  const uploaded = await rbUpload({
    bucket: route.bucket,
    file,
    folder: route.folder,
    mediaType,
    section: route.section,
    visibility: route.visibility,
    metadata: {
      upload_type: type,
      table: route.table,
      column: route.column,
      mode: route.mode,
      ...cleanMetadata(metadata)
    },
    upsert
  });

  return {
    ...uploaded,
    route,
    mediaType
  };
}

export async function createContentWithUpload({
  type,
  file,
  values = {},
  metadata = {},
  match = {},
  upsert = false,
  award = true
}) {
  const route = getUploadRoute(type);
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  const uploaded = await uploadByRoute({
    type,
    file,
    metadata,
    upsert
  });

  const urlValue = uploadedValue(uploaded, route);

  if (!urlValue) {
    throw new Error("Upload finished but no file URL/path returned.");
  }

  let record = null;
  let needsTarget = false;

  if (route.mode === "update-profile") {
    const rows = await rbUpdate({
      table: route.table,
      match: { id: user.id },
      values: {
        [route.column]: urlValue,
        updated_at: now()
      }
    });

    record = firstRow(rows);
  } else if (route.mode === "upsert-user") {
    const rows = await rbUpsert({
      table: route.table,
      values: {
        ...identityPayload(),
        ...values,
        [route.column]: urlValue,
        metadata: {
          ...cleanMetadata(metadata),
          ...(values.metadata || {})
        },
        updated_at: now()
      },
      onConflict: "user_id"
    });

    record = firstRow(rows);
  } else if (route.mode === "attach") {
    const finalMatch = Object.keys(match).length ? match : { id: values.id };

    if (!finalMatch?.id) {
      needsTarget = true;
    } else {
      const rows = await rbUpdate({
        table: route.table,
        match: finalMatch,
        values: {
          [route.column]: urlValue,
          updated_at: now()
        }
      });

      record = firstRow(rows);
    }
  } else if (route.mode === "upload-only") {
    record = uploaded.upload || uploaded || null;
  } else {
    const rows = await rbInsert({
      table: route.table,
      values: insertPayload({
        route,
        values,
        urlValue,
        metadata,
        mediaType: uploaded.mediaType
      })
    });

    record = firstRow(rows);
  }

  let actionResult = null;

  if (award && !needsTarget) {
    actionResult = await dispatchUploadAction({
      type,
      route,
      record,
      uploaded,
      urlValue,
      values,
      metadata
    });
  }

  return {
    uploaded,
    record,
    action: actionResult,
    needsTarget,
    route,
    url: urlValue
  };
}

export async function attachUploadToRecord({
  type,
  file,
  id,
  values = {},
  metadata = {},
  upsert = false,
  award = true
}) {
  return await createContentWithUpload({
    type,
    file,
    values: {
      ...values,
      id
    },
    match: { id },
    metadata,
    upsert,
    award
  });
}

export async function profileAvatarUpload(file) {
  return await createContentWithUpload({
    type: "profileAvatar",
    file,
    upsert: true
  });
}

export async function profileBannerUpload(file) {
  return await createContentWithUpload({
    type: "profileBanner",
    file,
    upsert: true
  });
}

export async function metaAvatarUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "metaAvatar",
    file,
    values,
    upsert: true
  });
}

export async function metaWorldUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "metaWorld",
    file,
    values
  });
}

export async function feedPostUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "feedPost",
    file,
    values
  });
}

export async function musicTrackUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "musicTrack",
    file,
    values
  });
}

export async function podcastAudioUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "podcastAudio",
    file,
    values
  });
}

export async function gameClipUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "gameClip",
    file,
    values
  });
}

export async function sportsClipUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "sportsClip",
    file,
    values
  });
}

export async function storeProductUpload(file, values = {}) {
  return await createContentWithUpload({
    type: "storeProduct",
    file,
    values
  });
}

console.log("RB UPLOAD ROUTER READY");
