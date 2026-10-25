/** Header checks deter casual copying; they cannot authenticate an unmodified tunnel app. */
export function blockedDownloadReason(headers: Headers): string | null {
  const ua = headers.get("user-agent") ?? "";
  if (headers.get("sec-fetch-mode") || headers.get("sec-fetch-dest") || headers.get("sec-ch-ua")) return "browser headers";
  if (/Mozilla\/|Chrome\/|Safari\/|Firefox\/|Edg\/|OPR\/|SamsungBrowser/i.test(ua)) return "browser user agent";
  if ((headers.get("accept") ?? "").includes("text/html")) return "html accept";
  if (/curl|wget|termux|python|httpie|postman|insomnia|powershell|node-fetch|undici|go-http-client|libwww|bot|spider|crawler/i.test(ua)) return "download tool or preview bot";
  // Actual imports in the access log use Android's Dalvik HTTP client.
  if (!/^(Dalvik\/\d|okhttp\/\d|HTTP[ -]?Custom(?:\/|\s|$))/i.test(ua)) return "unrecognized importing app";
  if (headers.has("range")) return "partial download unsupported";
  return null;
}

/**
 * Device identity = the importing app's user agent (Android version, phone model, build).
 * The network address is deliberately excluded: mobile networks rotate it between tries,
 * which made the same phone look like a different device.
 */
export async function importerHash(userAgent: string): Promise<string> {
  const bytes = new TextEncoder().encode(`device\n${userAgent.trim().slice(0, 400)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type ClaimResult = "new" | "used_up" | "expired" | "missing" | "invalid";

/**
 * Pure mirror of the database claim: every import, even a repeat by the same phone, uses one download.
 */
export function decideClaim(
  file: { expires_at: string; downloads: number; max_downloads: number | null },
  now = Date.now(),
): ClaimResult {
  if (new Date(file.expires_at).getTime() <= now) return "expired";
  if (file.max_downloads !== null && file.downloads >= file.max_downloads) return "used_up";
  return "new";
}

export function fileIsActive(file: { expires_at: string; downloads: number; max_downloads: number | null }, now = Date.now()): boolean {
  return new Date(file.expires_at).getTime() > now && (file.max_downloads === null || file.downloads < file.max_downloads);
}