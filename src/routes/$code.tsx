import { createFileRoute } from "@tanstack/react-router";
import { blockedDownloadReason, importerHash } from "@/lib/download-security";

const page = (title: string, msg: string) =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:linear-gradient(135deg,#dbeafe,#f5f5f5,#e0f2fe);color:#111"><div style="padding:40px;border-radius:24px;background:rgba(255,255,255,.55);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.7);text-align:center;max-width:320px"><h1 style="margin:0 0 8px;font-size:22px">${title}</h1><p style="margin:0 0 20px;color:#555">${msg}</p><a href="/" style="color:#3B82F6;font-weight:600;text-decoration:none">Mr Frank Cloud Config →</a></div></body></html>`;

const html = (t: string, m: string, status: number) =>
  new Response(page(t, m), { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });

/** Shown to browsers instead of the file: explains the link and helps the user open HTTP Custom. Never serves the file. */
const configInfoPage = (code: string) => {
  const link = `https://cloudvpn.mrfrankofc.com/${code}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cloud config — Mr Frank Cloud Config</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:linear-gradient(135deg,#dbeafe,#f5f5f5,#e0f2fe);color:#111"><div style="padding:36px 28px;border-radius:24px;background:rgba(255,255,255,.55);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.7);text-align:center;max-width:340px"><div style="font-size:40px;margin-bottom:8px">☁️</div><h1 style="margin:0 0 8px;font-size:21px">This is a cloud config file</h1><p style="margin:0 0 6px;color:#444;font-size:14px">It's made for the <b>HTTP Custom</b> app — it can't be downloaded in a browser.</p><p style="margin:0 0 18px;color:#666;font-size:13px">Copy the link below, open HTTP Custom, and paste it to import.</p><div style="display:flex;gap:8px;margin-bottom:14px"><input id="lnk" readonly value="${link}" style="flex:1;min-width:0;padding:10px 12px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;font-size:13px;font-family:monospace"><button onclick="navigator.clipboard.writeText(document.getElementById('lnk').value).then(()=>{this.textContent='Copied!'}).catch(()=>{const i=document.getElementById('lnk');i.select();document.execCommand('copy');this.textContent='Copied!'})" style="padding:10px 14px;border-radius:12px;border:0;background:#3B82F6;color:#fff;font-weight:600;cursor:pointer">Copy</button></div><a href="${OPEN_APP}" style="display:block;padding:12px;border-radius:12px;background:#3B82F6;color:#fff;font-weight:600;text-decoration:none;margin-bottom:8px">Open HTTP Custom app</a><a href="${PLAY_URL}" style="display:block;padding:12px;border-radius:12px;background:rgba(255,255,255,.7);border:1px solid #cbd5e1;color:#111;font-weight:600;text-decoration:none;font-size:13px">Don't have it? Get HTTP Custom on Play Store</a><p style="margin:16px 0 0;font-size:12px;color:#888">Mr Frank Cloud Config · cloudvpn.mrfrankofc.com</p></div></body></html>`;
};

const configHtml = (code: string) =>
  new Response(configInfoPage(code), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" } });

/** Browser-looking requests get the explainer page; download tools and bots still get a plain 404. */
const isBrowserBlock = (reason: string) =>
  reason === "browser headers" || reason === "browser user agent" || reason === "html accept";

const APP_PACKAGE = "xyz.easypro.httpcustom";
const PLAY_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const OPEN_APP = `intent://#Intent;package=${APP_PACKAGE};end`;

export const Route = createFileRoute("/$code")({
  head: () => ({ meta: [
    { title: "Config link — Mr Frank Cloud Config" },
    { name: "description", content: "Private, time-limited config import link from Mr Frank Cloud Config." },
    { property: "og:title", content: "Config link — Mr Frank Cloud Config" },
    { property: "og:description", content: "Private, time-limited config import link." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  server: {
    handlers: {
      HEAD: () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } }),
      GET: async ({ params, request }) => {
        const code = String(params.code).toLowerCase();
        if (!/^[a-z0-9]{4,12}$/.test(code)) return html("404 — Not found", "This link is invalid or has expired.", 404);
        try {
          const { getExternalFile, publicFile, readExternalBytes, claimExternalImport, logExternalAttempt } = await import("@/lib/external-storage.server");
          const external = await getExternalFile(code);
          if (external) {
            const ua = (request.headers.get("user-agent") ?? "").slice(0, 400);
            const blocked = blockedDownloadReason(request.headers);
            const log = async (allowed: boolean, reason: string) => {
              try { await logExternalAttempt(code, ua, request.headers.get("cf-connecting-ip"), allowed, reason); } catch { /* Logging cannot authorize a retry. */ }
            };
            if (blocked) {
              await log(false, blocked);
              return isBrowserBlock(blocked) ? configHtml(code) : html("404 — Not found", "This link is invalid or has expired.", 404);
            }
            const row = publicFile(external);
            if (new Date(row.expires_at).getTime() <= Date.now() || (row.max_downloads !== null && row.downloads >= row.max_downloads))
              return html("404 — Not found", "This link is invalid or has expired.", 404);
            const bytes = await readExternalBytes(external);
            if (!(await claimExternalImport(code, await importerHash(ua)))) {
              await log(false, "download limit reached or expired");
              return html("404 — Not found", "This link is invalid or has expired.", 404);
            }
            await log(true, "file transfer authorized");
            return new Response(bytes, { headers: {
              "Content-Type": "application/octet-stream", "Content-Length": String(bytes.byteLength),
              "Content-Disposition": `attachment; filename="${row.file_name.replace(/[^\x20-\x7e]|"|\\/g, "_")}"; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
              "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
            } });
          }
        } catch {
          return html("Unavailable", "This file can't be downloaded right now.", 503);
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("shared_files")
          .select("*")
          .eq("code", code)
          .maybeSingle();
        if (!row) return html("404 — Not found", "This link is invalid or has expired.", 404);
        const ua = (request.headers.get("user-agent") ?? "").slice(0, 400);
        // Only trust the edge-supplied address, never caller-controlled X-Forwarded-For.
        const host = new URL(request.url).hostname;
        const local = host === "localhost" || host === "127.0.0.1";
        const ip = request.headers.get("cf-connecting-ip") ?? (local ? "local-preview" : null);
        const blocked = blockedDownloadReason(request.headers) ?? (!ip ? "missing trusted network identity" : null);
        const log = (allowed: boolean, reason: string | null) =>
          supabaseAdmin.from("download_logs").insert({ code, user_agent: ua, ip, allowed, reason });
        if (blocked) {
          await log(false, blocked);
          if (isBrowserBlock(blocked)) return configHtml(code);
          return html("404 — Not found", "This link is invalid or has expired.", 404);
        }
        if (new Date(row.expires_at).getTime() <= Date.now())
          return html("404 — Not found", "This link is invalid or has expired.", 404);
        const identity = await importerHash(ua);
        const { data: blob, error } = await supabaseAdmin.storage.from("files").download(row.storage_path);
        if (error || !blob) return html("Unavailable", "This file can't be downloaded right now.", 404);
        // Reserve only once the complete file is available. The database atomically
        // checks expiry, per-device slots and the limit, including simultaneous requests.
        const { data: result, error: claimError } = await supabaseAdmin.rpc("claim_file_import", { p_code: code, p_importer_hash: identity });
        if (claimError) return html("Unavailable", "This file can't be downloaded right now.", 503);
        if (result !== "new") {
          await log(false, result === "used_up" ? "download limit reached" : `not available: ${result}`);
          return html("404 — Not found", "This link is invalid or has expired.", 404);
        }
        await log(true, "file transfer authorized");
        const encoded = encodeURIComponent(row.file_name);
        const ascii = row.file_name.replace(/[^\x20-\x7e]|"/g, "_");
        return new Response(blob.stream(), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(blob.size),
            "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});
