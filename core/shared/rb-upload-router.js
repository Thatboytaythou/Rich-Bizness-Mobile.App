/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-upload-router.js
========================= */

import {
  RB_BUCKETS,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  rbUpload,
  detectMediaType
} from "/core/shared/rb-storage.js";

import {
  getSupabase,
  getUser,
  rbInsert,
  rbUpdate
} from "/core/shared/rb-supabase.js";

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

  podcastAudio: {
    bucket: RB_BUCKETS.podcastAudio,
    folder: "episodes",
    section: "podcast",
    visibility: "public",
    table: RB_TABLES.podcastEpisodes,
    column: "audio_url",
    mode: "insert"
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

  gameClip: {
    bucket: RB_BUCKETS.gameClips,
    folder: "clips",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.gameClips,
    column: "clip_url",
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

  storeProduct: {
    bucket: RB_BUCKETS.storeProducts,
    folder: "products",
    section: "store",
    visibility: "public",
    table: RB_TABLES.products,
    column: "image_url",
    mode: "insert"
  },

  storeDigital: {
    bucket: RB_BUCKETS.storeDigital,
    folder: "digital",
    section: "store",
    visibility: "private",
    table: RB_TABLES.products,
    column: "digital_file_url",
    mode: "attach"
  },

  metaWorld: {
    bucket: RB_BUCKETS.metaWorlds,
    folder: "worlds",
    section: "meta",
    visibility: "public",
    table: RB_TABLES.metaWorlds,
    column: "world_url",
    mode: "attach"
  }
});

export function getUploadRoute(type) {
  const route = RB_UPLOAD_ROUTES[type];

  if (!route) {
    throw new Error(`Unknown upload route: ${type}`);
  }

  return route;
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
      ...metadata
    },
    upsert
  });
}

function uploadedValue(uploaded, route) {
  if (route.visibility === "public") {
    return uploaded?.publicUrl || uploaded?.public_url || "";
  }

  return uploaded?.path || uploaded?.file_path || "";
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
      record: data?.[0] || null
    };
  }

  if (route.mode === "upsert-user") {
    const { data, error } = await getSupabase()
      .from(route.table)
      .upsert(
        {
          user_id: user.id,
          display_name: values.display_name || values.displayName || "",
          [route.column]: urlValue,
          metadata: {
            source: "Rich Bizness Mobile",
            ...metadata
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      )
      .select()
      .maybeSingle();

    if (error) throw error;

    return {
      uploaded,
      record: data || null
    };
  }

  if (route.mode === "attach") {
    const finalMatch = Object.keys(match).length ? match : { id: values.id };

    if (!finalMatch?.id) {
      return {
        uploaded,
        record: null,
        needsTarget: true
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
      record: data?.[0] || null
    };
  }

  if (route.mode === "upload-only") {
    return {
      uploaded,
      record: uploaded.upload || null
    };
  }

  const record = {
    ...values,
    user_id: values.user_id || user.id,
    [route.column]: urlValue,
    metadata: {
      source: "Rich Bizness Mobile",
      ...metadata,
      ...(values.metadata || {})
    }
  };

  const data = await rbInsert({
    table: route.table,
    values: record
  });

  return {
    uploaded,
    record: data?.[0] || null
  };
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

console.log("RB UPLOAD ROUTER READY");
