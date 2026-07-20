import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type StoredObject = { reference: string; publicUrl?: string };

const playerPhotosBucket = process.env.SUPABASE_PLAYER_PHOTOS_BUCKET ?? "player-photos";
const submissionsBucket = process.env.SUPABASE_SUBMISSIONS_BUCKET ?? "submission-files";

function shouldUseSupabaseStorage() {
  if (process.env.FILE_STORAGE_BACKEND === "supabase") return true;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production file storage is not configured. Set FILE_STORAGE_BACKEND=supabase.");
  }
  return false;
}

function supabaseStorageClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Storage is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function uploadSupabaseObject(input: {
  bucket: string;
  objectKey: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
  publicRead: boolean;
}): Promise<StoredObject> {
  const client = supabaseStorageClient();
  const { error } = await client.storage.from(input.bucket).upload(input.objectKey, input.body, {
    contentType: input.contentType,
    cacheControl: input.cacheControl,
    upsert: false,
  });
  if (error) throw new Error("Supabase Storage upload failed: " + error.message);

  const reference = "supabase://" + input.bucket + "/" + input.objectKey;
  if (!input.publicRead) return { reference };

  const { data } = client.storage.from(input.bucket).getPublicUrl(input.objectKey);
  if (!data.publicUrl) throw new Error("Supabase Storage did not return a public photo URL.");
  return { reference, publicUrl: data.publicUrl };
}

export async function storePlayerPhotoObject(input: { playerId: string; body: Buffer }): Promise<string> {
  const objectKey = input.playerId + "/" + randomUUID() + ".webp";

  if (shouldUseSupabaseStorage()) {
    const stored = await uploadSupabaseObject({
      bucket: playerPhotosBucket,
      objectKey,
      body: input.body,
      contentType: "image/webp",
      cacheControl: "31536000",
      publicRead: true,
    });
    return stored.publicUrl ?? stored.reference;
  }

  const relativePath = path.join("uploads", "player-photos", objectKey);
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.body);
  return "/" + relativePath.replace(/\\/g, "/");
}

export async function storeSubmissionFileObject(input: {
  originalFilename: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const safeName = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "submission";
  const objectKey = new Date().toISOString().slice(0, 10) + "/" + randomUUID() + "-" + safeName;

  if (shouldUseSupabaseStorage()) {
    const stored = await uploadSupabaseObject({
      bucket: submissionsBucket,
      objectKey,
      body: input.body,
      contentType: input.contentType,
      publicRead: false,
    });
    return stored.reference;
  }

  const relativePath = path.join("storage", "submissions", objectKey);
  const absolutePath = path.join(process.cwd(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.body);
  return relativePath;
}
