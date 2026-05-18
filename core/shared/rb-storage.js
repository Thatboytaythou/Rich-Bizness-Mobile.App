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

export function createStoragePath({
  folder = "general",
  fileName = "file",
  userId = null
}) {
  const activeUser = userId || getUser()?.id || "anonymous";

  const safeName = String(fileName || "file")
    .replace(/\s+/g, "-")
    .replace(/[^\w.-]/g, "")
    .toLowerCase();

  return `${activeUser}/${folder}/${Date.now()}-${safeName}`;
}

export function getBucketPublicUrl(bucket, path) {
  return getPublicFileUrl(bucket, path);
}

export function detectMediaType(file = null) {
  if (!file?.type) return "file";

  const type = file.type.toLowerCase();

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";

  if (
    type.includes("pdf") ||
    type.includes("zip") ||
    type.includes("document") ||
    type.includes("text") ||
    type.includes("json")
  ) {
    return "document";
  }

  return "file";
}

export async function rbUpload({
  bucket,
  file,
  folder = "general",
  mediaType = null,
  section = "general",
  category = "general",
  title = "",
  description = "",
  visibility = "public",
  metadata = {},
  upsert = false
}) {
  if (!bucket) throw new Error("Missing bucket.");
  if (!file) throw new Error("Missing file.");

  const user = getUser();
  if (!user?.id) throw new Error("You must be signed in.");

  const finalMediaType = mediaType || detectMediaType(file);

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
      : "";

  const uploadRecord = {
    user_id: user.id,
    category,
    section,
    title,
    description,
    bucket,
    file_path: path,
    public_url: publicUrl,
    mime_type: file.type || "",
    file_size: file.size || 0,
    media_type: finalMediaType,
    visibility,
    processing_status: "completed",
    metadata: {
      original_name: file.name || "",
      source: "Rich Bizness Mobile",
      ...metadata
    }
  };

  const inserted = await rbInsert({
    table: RB_TABLES.uploads,
    values: uploadRecord
  });

  return {
    bucket,
    path,
    publicUrl,
    mediaType: finalMediaType,
    upload: inserted?.[0] || null
  };
}

export async function rbDeleteFile({ bucket, path }) {
  if (!bucket || !path) {
    throw new Error("Missing storage delete info.");
  }

  await deleteFile({
    bucket,
    paths: [path]
  });

  return true;
}

export function createObjectPreview(file) {
  if (!file) return null;
  return URL.createObjectURL(file);
}

export async function createSignedDownload({
  bucket,
  path,
  expiresIn = 60
}) {
  const { data, error } =
    await getSupabase()
      .storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data?.signedUrl || null;
}

export const bucketFor = Object.freeze({
  avatar: RB_BUCKETS.avatars,
  profileBanner: RB_BUCKETS.profileBanners,
  metaAvatar: RB_BUCKETS.metaAvatars,
  metaWorld: RB_BUCKETS.metaWorlds,

  general: RB_BUCKETS.generalUploads,
  gallery: RB_BUCKETS.galleryMedia,

  musicAudio: RB_BUCKETS.musicAudio,
  musicCover: RB_BUCKETS.musicCovers,

  podcastAudio: RB_BUCKETS.podcastAudio,
  podcastCover: RB_BUCKETS.podcastCovers,

  radioCover: RB_BUCKETS.radioCovers,

  liveThumbnail: RB_BUCKETS.liveThumbnails,
  liveRecording: RB_BUCKETS.liveRecordings,

  gameAsset: RB_BUCKETS.gameAssets,
  gameClip: RB_BUCKETS.gameClips,
  gameCover: RB_BUCKETS.gameCovers,

  sportsMedia: RB_BUCKETS.sportsMedia,
  sportsClip: RB_BUCKETS.sportsClips,
  sportsCover: RB_BUCKETS.sportsCovers,

  storeProduct: RB_BUCKETS.storeProducts,
  storeSellerMedia: RB_BUCKETS.storeSellerMedia,
  storeDigital: RB_BUCKETS.storeDigital
});

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

console.log("RB STORAGE READY");
