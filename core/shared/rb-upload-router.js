/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-upload-router.js

   UPLOAD SECTION ROUTER
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
  rbInsert
} from "/core/shared/rb-supabase.js";

/* =========================
   SECTION MAP
========================= */

export const RB_UPLOAD_ROUTES = Object.freeze({
  profileAvatar: {
    bucket: RB_BUCKETS.avatars,
    folder: "avatars",
    section: "profile",
    visibility: "public",
    table: RB_TABLES.profiles,
    column: "avatar_url"
  },

  profileBanner: {
    bucket: RB_BUCKETS.profileBanners,
    folder: "banners",
    section: "profile",
    visibility: "public",
    table: RB_TABLES.profiles,
    column: "banner_url"
  },

  metaAvatar: {
    bucket: RB_BUCKETS.metaAvatars,
    folder: "avatars",
    section: "meta",
    visibility: "public",
    table: RB_TABLES.metaAvatars,
    column: "avatar_url"
  },

  feedPost: {
    bucket: RB_BUCKETS.generalUploads,
    folder: "feed",
    section: "feed",
    visibility: "public",
    table: RB_TABLES.feedPosts,
    column: "media_url"
  },

  musicTrack: {
    bucket: RB_BUCKETS.musicAudio,
    folder: "tracks",
    section: "music",
    visibility: "public",
    table: RB_TABLES.musicTracks,
    column: "audio_url"
  },

  musicCover: {
    bucket: RB_BUCKETS.musicCovers,
    folder: "covers",
    section: "music",
    visibility: "public",
    table: RB_TABLES.musicTracks,
    column: "cover_url"
  },

  podcastAudio: {
    bucket: RB_BUCKETS.podcastAudio,
    folder: "episodes",
    section: "podcast",
    visibility: "public",
    table: RB_TABLES.podcastEpisodes,
    column: "audio_url"
  },

  podcastCover: {
    bucket: RB_BUCKETS.podcastCovers,
    folder: "covers",
    section: "podcast",
    visibility: "public",
    table: RB_TABLES.podcastEpisodes,
    column: "cover_url"
  },

  radioCover: {
    bucket: RB_BUCKETS.radioCovers,
    folder: "radio",
    section: "radio",
    visibility: "public",
    table: RB_TABLES.radioStations,
    column: "cover_url"
  },

  liveThumbnail: {
    bucket: RB_BUCKETS.liveThumbnails,
    folder: "thumbnails",
    section: "live",
    visibility: "public",
    table: RB_TABLES.liveStreams,
    column: "thumbnail_url"
  },

  liveRecording: {
    bucket: RB_BUCKETS.liveRecordings,
    folder: "recordings",
    section: "live",
    visibility: "private",
    table: RB_TABLES.liveStreams,
    column: "recording_url"
  },

  gameAsset: {
    bucket: RB_BUCKETS.gameAssets,
    folder: "assets",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.games,
    column: "cover_url"
  },

  gameClip: {
    bucket: RB_BUCKETS.gameClips,
    folder: "clips",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.gameClips,
    column: "clip_url"
  },

  gameCover: {
    bucket: RB_BUCKETS.gameCovers,
    folder: "covers",
    section: "gaming",
    visibility: "public",
    table: RB_TABLES.games,
    column: "cover_url"
  },

  sportsMedia: {
    bucket: RB_BUCKETS.sportsMedia,
    folder: "media",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsPosts,
    column: "media_url"
  },

  sportsClip: {
    bucket: RB_BUCKETS.sportsClips,
    folder: "clips",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsPosts,
    column: "media_url"
  },

  sportsCover: {
    bucket: RB_BUCKETS.sportsCovers,
    folder: "covers",
    section: "sports",
    visibility: "public",
    table: RB_TABLES.sportsPosts,
    column: "thumbnail_url"
  },

  galleryArtwork: {
    bucket: RB_BUCKETS.galleryMedia,
    folder: "artworks",
    section: "gallery",
    visibility: "public",
    table: RB_TABLES.artworks,
    column: "artwork_url"
  },

  storeProduct: {
    bucket: RB_BUCKETS.storeProducts,
    folder: "products",
    section: "store",
    visibility: "public",
    table: RB_TABLES.products,
    column: "cover_url"
  },

  storeDigital: {
    bucket: RB_BUCKETS.storeDigital,
    folder: "digital",
    section: "store",
    visibility: "private",
    table: RB_TABLES.products,
    column: "digital_file_url"
  },

  storeSellerMedia: {
    bucket: RB_BUCKETS.storeSellerMedia,
    folder: "seller",
    section: "store",
    visibility: "public",
    table: RB_TABLES.storeSellerProfiles,
    column: "banner_url"
  },

  metaWorld: {
    bucket: RB_BUCKETS.metaWorlds,
    folder: "worlds",
    section: "meta",
    visibility: "public",
    table: RB_TABLES.metaWorlds,
    column: "world_url"
  }
});

/* =========================
   ROUTE GETTER
========================= */

export function getUploadRoute(type) {
  const route = RB_UPLOAD_ROUTES[type];

  if (!route) {
    throw new Error(`Unknown upload route: ${type}`);
  }

  return route;
}

/* =========================
   UPLOAD ONLY
========================= */

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
      ...metadata
    },
    upsert
  });
}

/* =========================
   CREATE CONTENT AFTER UPLOAD
========================= */

export async function createContentWithUpload({
  type,
  file,
  values = {},
  metadata = {},
  upsert = false
}) {
  const route = getUploadRoute(type);

  const uploaded = await uploadByRoute({
    type,
    file,
    metadata,
    upsert
  });

  const urlValue =
    route.visibility === "public"
      ? uploaded.publicUrl
      : uploaded.path;

  const record = {
    ...values,
    [route.column]: urlValue
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

/* =========================
   LIST ROUTES
========================= */

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
