import { MongoClient, type Db, type Document } from "mongodb";
import { CONFIG } from "./config.server";

const CDN = CONFIG.CDN_BASE_URL;
export type FileStatus = "active" | "expired" | "used_up";
export type ExternalFile = {
  code: string; storage_path: string; file_name: string; size_bytes: number;
  content_type: string; downloads: number; max_downloads: number | null;
  expiry_minutes: number; created_at: Date; expires_at: Date;
  cdn_url: string; nonce: string;
  link_url: string; status: FileStatus;
};

// One shared connection, reused across requests.
let clientPromise: Promise<MongoClient> | undefined;

async function withDatabase<T>(run: (db: Db) => Promise<T>): Promise<T> {
  clientPromise ??= new MongoClient(CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 5 })
    .connect().catch((err) => { clientPromise = undefined; throw err; });
  let client: MongoClient;
  try { client = await clientPromise; } catch { throw new Error("File records are unavailable"); }
  return run(client.db(CONFIG.MONGODB_DB));
}

async function encryptionKey() {
  const secret = CONFIG.ENCRYPTION_SECRET;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function encode(bytes: Uint8Array) { return Buffer.from(bytes).toString("base64"); }
function decode(value: string) { return new Uint8Array(Buffer.from(value, "base64")); }

export async function storeExternalFile(file: File, code: string, max: number | null, minutes: number) {
  const key = CONFIG.CDN_API_KEY;
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await encryptionKey(), await file.arrayBuffer());
  const form = new FormData();
  form.append("file", new Blob([encrypted], { type: "application/octet-stream" }), `${code}.bin`);
  form.append("path", CONFIG.CDN_PATH);
  let response: Response;
  try { response = await fetch(`${CDN}/upload`, { method: "POST", headers: { "X-API-Key": key }, body: form, signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error("File storage is unavailable; try again"); }
  if (!response.ok) throw new Error("File storage rejected the upload");
  const result = await response.json() as { cdnUrl?: string; url?: string };
  const url = new URL(result.cdnUrl ?? result.url ?? "", CDN);
  if (url.origin !== CDN || !/^https:$/.test(url.protocol)) throw new Error("File storage returned an unsupported link");
  return withDatabase(async (db) => {
    const files = db.collection<ExternalFile>("shared_files");
    await files.createIndex({ code: 1 }, { unique: true });
    // MongoDB's clock starts expiry only after the CDN upload completes.
    await files.updateOne({ code }, [{ $set: {
      code: { $literal: code }, storage_path: { $literal: `mongo:${code}` },
      file_name: { $literal: file.name }, size_bytes: file.size,
      content_type: { $literal: file.type || "application/octet-stream" },
      downloads: 0, max_downloads: max, expiry_minutes: minutes,
      created_at: "$$NOW", expires_at: { $dateAdd: { startDate: "$$NOW", unit: "minute", amount: minutes } },
      cdn_url: { $literal: url.href }, nonce: { $literal: encode(nonce) },
      link_url: { $literal: `${CONFIG.SITE_URL}/${code}` }, status: "active",
    } }], { upsert: true });
    const row = await files.findOne({ code });
    if (!row) throw new Error("Could not save the file record");
    return publicFile(row);
  });
}

export function publicFile(row: ExternalFile) {
  return { code: row.code, storage_path: row.storage_path, file_name: row.file_name, size_bytes: row.size_bytes,
    content_type: row.content_type, downloads: row.downloads, max_downloads: row.max_downloads,
    expiry_minutes: row.expiry_minutes, status: row.status, link_url: row.link_url, created_at: row.created_at.toISOString(), expires_at: row.expires_at.toISOString() };
}

/** Looks a file up and keeps its stored status (active / expired / used_up) in sync. */
export async function getExternalFile(code: string) {
  return withDatabase(async (db) => {
    const files = db.collection<ExternalFile>("shared_files");
    const row = await files.findOne({ code });
    if (!row) return null;
    const status: FileStatus = row.expires_at.getTime() <= Date.now() ? "expired"
      : row.max_downloads !== null && row.downloads >= row.max_downloads ? "used_up" : "active";
    if (row.status !== status) { await files.updateOne({ code }, { $set: { status } }); row.status = status; }
    return row;
  });
}

export async function readExternalBytes(row: ExternalFile) {
  const url = new URL(row.cdn_url);
  if (url.origin !== CDN) throw new Error("Unsupported file location");
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!response.ok) throw new Error("File storage is unavailable");
  const encrypted = await response.arrayBuffer();
  if (encrypted.byteLength > 5 * 1024 * 1024 + 16) throw new Error("Invalid file size");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(row.nonce) }, await encryptionKey(), encrypted);
  if (plain.byteLength !== row.size_bytes) throw new Error("Invalid file content");
  return plain;
}

export async function claimExternalImport(code: string, identity: string) {
  return withDatabase(async db => {
    const files = db.collection<ExternalFile>("shared_files");
    const claimed = await files.findOneAndUpdate({ code, $expr: { $and: [
      { $gt: ["$expires_at", "$$NOW"] },
      { $or: [{ $eq: ["$max_downloads", null] }, { $lt: ["$downloads", "$max_downloads"] }] },
    ] } }, { $inc: { downloads: 1 }, $set: { last_importer_hash: identity } }, { returnDocument: "after" });
    if (claimed && claimed.max_downloads !== null && claimed.downloads >= claimed.max_downloads)
      await files.updateOne({ code }, { $set: { status: "used_up" } });
    return !!claimed;
  });
}

export async function logExternalAttempt(code: string, userAgent: string, ip: string | null, allowed: boolean, reason: string) {
  await withDatabase(async db => { await db.collection("download_logs").insertOne({ code, user_agent: userAgent, ip, allowed, reason, created_at: new Date() }); });
}

export async function listExternalFiles() {
  return withDatabase(async db => (await db.collection<ExternalFile>("shared_files").find().sort({ created_at: -1 }).limit(1000).toArray()).map(publicFile));
}

export async function listExternalLogs(code: string) {
  return withDatabase(async db => (await db.collection<Document>("download_logs").find({ code }).sort({ created_at: -1 }).limit(50).toArray()).map(row => ({
    id: String(row._id), user_agent: String(row['user_agent'] ?? ""), allowed: Boolean(row['allowed']),
    reason: String(row['reason'] ?? ""), created_at: (row['created_at'] as Date).toISOString(),
  })));
}