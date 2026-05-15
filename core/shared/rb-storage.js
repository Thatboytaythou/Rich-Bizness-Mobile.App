/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-storage.js

   STORAGE + MEDIA ENGINE
========================= */

import {
  RB_BUCKETS,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getPublicFileUrl,
  uploadFile,
  deleteFile,
  rbInsert
} from "/core/shared/rb-supabase.js";

/* =========================
   HELPERS
========================= */

export function createStoragePath({
  folder = "general",
  fileName = "file",
  userId = null
}) {
  const activeUser =
    userId ||
    getUser()?.id ||
    "anonymous";

  const safeName =
    fileName
      .replace(/\s+/g, "-")
      .replace(/[^\w.-]/g, "")
      .toLowerCase();

  const stamp = Date.now();

  return `${activeUser}/${folder}/${stamp}-${safeName}`;
}

export function getBucketPublicUrl(bucket, path) {
  return getPublicFileUrl(bucket, path);
}

/* =========================
   UNIVERSAL UPLOAD
========================= */

export async function rbUpload({
  bucket,
  file,
  folder = "general",
  mediaType = "file",
  section = "general",
  visibility = "public",
  metadata = {},
  upsert = false
}) {
  if (!bucket) {
    throw new Error("Missing bucket.");
  }

  if (!file) {
    throw new Error("Missing file.");
  }

  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  const path = createStoragePath({
    folder,
    fileName: file.name,
    userId: user.id
  });

  await uploadFile({
    bucket,
    path,
    file,
    upsert
  });

  const publicUrl =
    visibility === "public"
      ? getBucketPublicUrl(bucket, path)
      : null;

  const uploadRecord = {
    user_id: user.id,

    bucket,
    file_path: path,
    public_url: publicUrl,

    original_name: file.name,
    mime_type: file.type,
    file_size: file.size,

    media_type: mediaType,
    section,

    visibility,

    metadata
  };

  const inserted = await rbInsert({
    table: RB_TABLES.uploads,
    values: uploadRecord
  });

  return {
    bucket,
    path,
    publicUrl,
    upload: inserted?.[0] || null
  };
}

/* =========================
   DELETE FILE
========================= */

export async function rbDeleteFile({
  bucket,
  path
}) {
  if (!bucket || !path) {
    throw new Error("Missing storage delete info.");
  }

  await deleteFile({
    bucket,
    paths: [path]
  });

  return true;
}

/* =========================
   FILE TYPE DETECTION
========================= */

export function detectMediaType(file = null) {
  if (!file?.type) return "file";

  const type = file.type.toLowerCase();

  if (type.startsWith("image/")) {
    return "image";
  }

  if (type.startsWith("video/")) {
    return "video";
  }

  if (type.startsWith("audio/")) {
    return "audio";
  }

  if (
    type.includes("pdf") ||
    type.includes("zip") ||
    type.includes("document")
  ) {
    return "document";
  }

  return "file";
}

/* =========================
   BUCKET HELPERS
========================= */

export function avatarBucket() {
  return RB_BUCKETS.avatars;
}

export function profileBannerBucket() {
  return RB_BUCKETS.profileBanners;
}

export function musicAudioBucket() {
  return RB_BUCKETS.musicAudio;
}

export function musicCoverBucket() {
  return RB_BUCKETS.musicCovers;
}

export function podcastAudioBucket() {
  return RB_BUCKETS.podcastAudio;
}

export function podcastCoverBucket() {
  return RB_BUCKETS.podcastCovers;
}

export function liveThumbnailBucket() {
  return RB_BUCKETS.liveThumbnails;
}

export function liveRecordingBucket() {
  return RB_BUCKETS.liveRecordings;
}

export function gameClipBucket() {
  return RB_BUCKETS.gameClips;
}

export function gameAssetBucket() {
  return RB_BUCKETS.gameAssets;
}

export function sportsMediaBucket() {
  return RB_BUCKETS.sportsMedia;
}

export function galleryBucket() {
  return RB_BUCKETS.galleryMedia;
}

export function storeProductBucket() {
  return RB_BUCKETS.storeProducts;
}

export function storeDigitalBucket() {
  return RB_BUCKETS.storeDigital;
}

export function metaWorldBucket() {
  return RB_BUCKETS.metaWorlds;
}

/* =========================
   IMAGE PREVIEW
========================= */

export function createObjectPreview(file) {
  if (!file) return null;

  return URL.createObjectURL(file);
}

/* =========================
   SIGNED URL
========================= */

export async function createSignedDownload({
  bucket,
  path,
  expiresIn = 60
}) {
  const supabase = getSupabase();

  const { data, error } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

  if (error) throw error;

  return data?.signedUrl || null;
}
