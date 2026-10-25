import { createFileRoute } from "@tanstack/react-router";
import { parseExpiresMinutes, parseMaxDownloads } from "@/lib/download-limit";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
function makeCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const Route = createFileRoute("/api/public/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "No file provided" }, { status: 400 });
        }
        if (file.size > 5 * 1024 * 1024) {
          return Response.json({ error: "File too large (max 5MB)" }, { status: 413 });
        }
        // Burn after 1 is the default; an explicit "0" still means unlimited.
        const maxDownloads = parseMaxDownloads(form.get("maxDownloads"));
        const expiresMinutes = parseExpiresMinutes(form.get("expiresMinutes"));
        const code = makeCode();
        try {
          const { storeExternalFile } = await import("@/lib/external-storage.server");
          const inserted = await storeExternalFile(file, code, maxDownloads, expiresMinutes);
          return Response.json({ code, expires_at: inserted.expires_at, created_at: inserted.created_at, server_now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ error: "Upload unavailable. Please try again shortly." }, { status: 503 });
        }
      },
    },
  },
});
