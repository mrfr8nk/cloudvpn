// Hardcoded server config (as requested). Env vars of the same name still win,
// so a value already set in your host keeps working (important for
// CDN_FILE_ENCRYPTION_SECRET: files encrypted earlier need the same secret).
// Server-only: never import this from client code.
export const CONFIG = {
  MONGODB_URI:
    process.env["MONGODB_URI"] ??
    "mongodb+srv://darexmucheri:cMd7EoTwGglJGXwR@cluster0.uwf6z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  MONGODB_DB: "mr_frank_cloud_config",
  CDN_BASE_URL: "https://mrfranko-cdn.hf.space",
  CDN_API_KEY: process.env["MR_FRANK_CDN_API_KEY"] ?? "subzero",
  CDN_PATH: "ice/",
  // Files are AES-GCM encrypted before they reach the CDN, so the CDN URL alone is useless.
  ENCRYPTION_SECRET:
    process.env["CDN_FILE_ENCRYPTION_SECRET"] ?? "mrfrank-cdn-7f3a91c2e8b04d56a1f9c07be2d48a63",
  // Public links look like SITE_URL/<id>
  SITE_URL: "https://cloudvpn.mrfrankofc.com",
} as const;
