/* =========================
   RICH BIZNESS MOBILE
   /core/features/upload/upload-storage.js

   STORAGE ENGINE
   Bucket Uploads + Public URLs
   State-aware storage helper
========================= */

import {
  getSupabase,
  getPublicFileUrl
} from "/core/shared/rb-supabase.js";

import {
  setUploading,
  setUploadProgress,
  setUploadResult,
  setUploadError
} from "/core/features/upload/upload-state.js";

const supabase = getSupabase();

function cleanFileName(fileName = "") {
  return (
    String(fileName || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 120) || crypto.randomUUID()
  );
}

function cleanFolder(folder = "uploads") {
  return (
    String(folder || "uploads")
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-z0-9/_-]/g, "-") || "uploads"
  );
}

function buildFilePath({
  userId,
  folder = "uploads",
  fileName = ""
}) {
  if (!userId) {
    throw new Error("User required.");
  }

  const safeFolder = cleanFolder(folder);
  const safeName = cleanFileName(fileName);
  const stamp = Date.now();

  return `${userId}/${safeFolder}/${stamp}-${safeName}`;
}

export function detectMediaType(file) {
  const mime = String(file?.type || "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  return "file";
}

export function isPublicStorageUrl(url = "") {
  return String(url || "").includes("/storage/v1/object/public/");
}

export async function uploadToBucket({
  bucket,
  file,
  userId,
  folder = "uploads",
  upsert = false,
  contentType = file?.type || "application/octet-stream",
  cacheControl = "3600",
  metadata = {}
}) {
  try {
    if (!bucket) {
      throw new Error("Bucket required.");
    }

    if (!file) {
      throw new Error("File required.");
    }

    if (!userId) {
      throw new Error("User required.");
    }

    setUploading(true);
    setUploadProgress(5);

    const path = buildFilePath({
      userId,
      folder,
      fileName: file.name
    });

    setUploadProgress(20);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert,
        cacheControl,
        contentType,
        metadata: {
          source: "upload-storage.js",
          media_type: detectMediaType(file),
          original_name: file.name || null,
          ...metadata
        }
      });

    if (error) throw error;

    setUploadProgress(82);

    const publicUrl = getPublicFileUrl(bucket, data.path);

    const result = {
      bucket,
      path: data.path,
      publicUrl,
      public_url: publicUrl,
      fileName: file.name,
      file_name: file.name,
      fileSize: file.size,
      file_size: file.size,
      mimeType: file.type,
      mime_type: file.type,
      mediaType: detectMediaType(file),
      media_type: detectMediaType(file),
      isPublicUrl: isPublicStorageUrl(publicUrl)
    };

    setUploadProgress(100);
    setUploadResult(result);

    return result;
  } catch (error) {
    setUploadError(error);
    throw error;
  }
}

export async function deleteStorageFile({
  bucket,
  path
}) {
  if (!bucket || !path) {
    throw new Error("Bucket and path required.");
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) throw error;

  return data || [];
}

export async function deleteStorageFiles({
  bucket,
  paths = []
}) {
  if (!bucket || !paths.length) {
    throw new Error("Bucket and paths required.");
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .remove(paths);

  if (error) throw error;

  return data || [];
}

export async function listStorageFiles({
  bucket,
  folder = "",
  limit = 100,
  offset = 0,
  sortBy = {
    column: "created_at",
    order: "desc"
  }
}) {
  if (!bucket) {
    throw new Error("Bucket required.");
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(cleanFolder(folder), {
      limit,
      offset,
      sortBy
    });

  if (error) throw error;

  return data || [];
}

export async function createSignedStorageUrl({
  bucket,
  path,
  expiresIn = 60 * 10
}) {
  if (!bucket || !path) {
    throw new Error("Bucket and path required.");
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;

  return data?.signedUrl || null;
}

export function getStoragePublicUrl({
  bucket,
  path
}) {
  if (!bucket || !path) return null;

  return getPublicFileUrl(bucket, path);
}

console.log("RB UPLOAD STORAGE READY");
