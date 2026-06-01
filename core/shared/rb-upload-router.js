/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-upload-router.js

   MASTER UPLOAD ROUTER
   Buckets + Tables + Columns Locked
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
  getSupabase,
  getUser,
  getProfileIdentity,
  rbInsert,
  rbUpdate
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

export const RB_UPLOAD_ROUTES = Object.freeze({
  profileAvatar: {
    bucket: RB_BUCKETS.avatars,
    folder: "avatars",
    section: "profile",
    visibility: "public",
    table: RB_TABLES.profiles,
    column: "avatar_url",
    mode: "update-profile"
  },

  profileBanner: {
    bucket: RB_BUCKETS.profileBanners,
    folder: "banners",
    section: "profile",
    visibility: "public",
    table: RB_TABLES.profiles,
    column: "banner_url",
    mode: "update-profile"
  },

  metaAvatar: {
    bucket: RB_BUCKETS.metaAvatars,
    folder: "avatars",
    section: "meta",
    visibility: "public",
    table: RB_TABLES.metaAvatars,
    column: "avatar_url",
    mode: "upsert-user"
  },

  metaWorld: {
    bucket: RB_BUCKETS.metaWorlds,
    folder: "worlds",
    section: "meta",
    visibility: "public",
    table: RB_TABLES.metaWorlds,
    column: "world_url",
    mode: "attach"
  },

  feedPost: {
    bucket: RB_BUCKETS.generalUploads,
    folder: "feed",
    section: "feed",
    visibility: "public",
    table: RB_TABLES.feedPosts,
    column: "media_url",
    mode: "insert"
  },

  galleryMedia: {
    bucket: RB_BUCKETS.galleryMedia,
    folder: "gallery",
    section: "gallery",
    visibility: "public",
    table: RB_TABLES.uploads,
    column: "public_url",
    mode: "upload-only"
  },

  musicTrack: {
    bucket: RB_BUCKETS.musicAudio,
    folder: "tracks",
    section: "music",
    visibility: "public",
    table: RB_TABLES.musicTracks,
    column: "audio_url",
    mode: "insert"
  },

  musicCover: {
    bucket: RB_BUCKETS.musicCovers,
    folder: "covers",
    section: "music",
    visibility: "public",
    table: RB_TABLES.musicTracks,
    column: "cover_url",
    mode: "attach"
  },

  podcastAudio: {
    bucket: RB_BUCKETS.podcastAudio,
    folder: "episodes",
    section: "podcast",
    visibility: "public",
    table: RB_TABLES.podcastEpisodes,
    column: "audio_url",
    mode: "insert"
  },

  podcastCover: {
    bucket: RB_BUCKETS.podcastCovers,
    folder: "covers",
    section: "podcast",
    visibility: "public",
    table: RB_TABLES.podcastEpisodes,
    column: "cover_url",
    mode: "attach"
  },

  radioCover: {
    bucket: RB_BUCKETS.radioCovers,
    folder: "radio",
    section: "radio",
    visibility: "public",
    table: RB_TABLES.radioStations,
    column: "cover_url",
    mode: "attach"
  },

  liveThumbnail: {
    bucket: RB_BUCKETS.liveThumbnails,
    folder: "thumbnails",
    section: "live",
    visibility: "public",
    table: RB_TABLES.liveStreams,
    column: "thumbnail_url",
    mode: "attach"
  },

  liveRecording: {
    bucket: RB_BUCKETS.liveRecordings,
    folder: "recordings",
    section: "live",
    visibility: "private",
    table: RB_TABLES.liveStreams,
    column: "recording_url",
    mode: "attach"
  },

  gameAsset: {
    bucket: RB_BUCKETS.gameAssets,
    folder: "assets",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.games,
    column: "play_url",
    mode: "attach"
  },

  gameClip: {
    bucket: RB_BUCKETS.gameClips,
    folder: "clips",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.gameClips,
    column: "clip_url",
    mode: "insert"
  },

  gameCover: {
    bucket: RB_BUCKETS.gameCovers,
    folder: "covers",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.games,
    column: "cover_url",
    mode: "attach"
  },

  sportsMedia: {
    bucket: RB_BUCKETS.sportsMedia,
    folder: "media",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsUploads,
    column: "file_url",
    mode: "insert"
  },

  sportsClip: {
    bucket: RB_BUCKETS.sportsClips,
    folder: "clips",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsUploads,
    column: "file_url",
    mode: "insert"
  },

  sportsCover: {
    bucket: RB_BUCKETS.sportsCovers,
    folder: "covers",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsPosts,
    column: "cover_url",
    mode: "attach"
  },

  storeProduct: {
    bucket: RB_BUCKETS.storeProducts,
    folder: "products",
    section: "store",
    visibility: "public",
    table: RB_TABLES.products,
    column: "image_url",
    mode: "insert"
  },

  storeSellerMedia: {
    bucket: RB_BUCKETS.storeSellerMedia,
    folder: "seller",
    section: "store",
    visibility: "public",
    table: RB_TABLES.storeSellerProfiles,
    column: "banner_url",
    mode: "upsert-user"
  },

  storeDigital: {
    bucket: RB_BUCKETS.storeDigital,
    folder: "digital",
    section: "store",
    visibility: "private",
    table: RB_TABLES.products,
    column: "digital_file_url",
    mode: "attach"
  }
});

function routeFromConfig(type) {
  const route = CONFIG_UPLOAD_ROUTES?.[type];
  if (!route) return null;

  return {
    bucket: route.bucket,
    folder: type,
    section: type,
    visibility:
      route.bucket === RB_BUCKETS.storeDigital ||
      route.bucket === RB_BUCKETS.liveRecordings
        ? "private"
        : "public",
    table: route.table,
    column: route.column,
    mode: "attach"
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
    return uploaded?.publicUrl || uploaded?.public_url || "";
  }

  return uploaded?.path || uploaded?.file_path || "";
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

  return {
    user_id: user?.id || identity?.user_id || null,
    username: identity?.username || null,
    display_name: identity?.display_name || null,
    ...extra
  };
}

export async function uploadByRoute({
  type,
  file,
  metadata = {},
  upsert = false
}) {
  const route = getUploadRoute(type);
  const mediaType = detectMediaType(file);

  return await rbUpload({
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
}

export async function createContentWithUpload({
  type,
  file,
  values = {},
  metadata = {},
  match = {},
  upsert = false
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

  if (route.mode === "update-profile") {
    const data = await rbUpdate({
      table: route.table,
      match: { id: user.id },
      values: {
        [route.column]: urlValue,
        updated_at: new Date().toISOString()
      }
    });

    return {
      uploaded,
      record: data?.[0] || null,
      route
    };
  }

  if (route.mode === "upsert-user") {
    const { data, error } = await supabase
      .from(route.table)
      .upsert(
        {
          ...identityPayload(),
          ...values,
          [route.column]: urlValue,
          metadata: {
            ...cleanMetadata(metadata),
            ...(values.metadata || {})
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .maybeSingle();

    if (error) throw error;

    return {
      uploaded,
      record: data || null,
      route
    };
  }

  if (route.mode === "attach") {
    const finalMatch = Object.keys(match).length ? match : { id: values.id };

    if (!finalMatch?.id) {
      return {
        uploaded,
        record: null,
        needsTarget: true,
        route
      };
    }

    const data = await rbUpdate({
      table: route.table,
      match: finalMatch,
      values: {
        [route.column]: urlValue,
        updated_at: new Date().toISOString()
      }
    });

    return {
      uploaded,
      record: data?.[0] || null,
      route
    };
  }

  if (route.mode === "upload-only") {
    return {
      uploaded,
      record: uploaded.upload || null,
      route
    };
  }

  const record = {
    ...identityPayload(),
    ...values,
    [route.column]: urlValue,
    metadata: {
      ...cleanMetadata(metadata),
      ...(values.metadata || {})
    }
  };

  const data = await rbInsert({
    table: route.table,
    values: record
  });

  return {
    uploaded,
    record: data?.[0] || null,
    route
  };
}

export async function attachUploadToRecord({
  type,
  file,
  id,
  values = {},
  metadata = {},
  upsert = false
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
    upsert
  });
}

export async function profileAvatarUpload(file) {
  return await createContentWithUpload({
    type: "profileAvatar",
    file
  });
}

export async function profileBannerUpload(file) {
  return await createContentWithUpload({
    type: "profileBanner",
    file
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
