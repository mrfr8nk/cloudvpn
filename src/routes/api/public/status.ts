import { createFileRoute } from "@tanstack/react-router";
import { fileIsActive } from "@/lib/download-security";

export const Route = createFileRoute("/api/public/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("code") ?? "";
        const code = (raw.trim().replace(/\/+$/, "").split("/").pop() ?? "").toLowerCase();
        if (!/^[a-z0-9]{4,12}$/.test(code)) return Response.json({ error: "Invalid code" }, { status: 400 });
        try {
          const { getExternalFile, publicFile } = await import("@/lib/external-storage.server");
          const row = await getExternalFile(code);
          if (row) {
            const data = publicFile(row);
            return Response.json({ ...data, server_now: new Date().toISOString(), used_up: data.max_downloads != null && data.downloads >= data.max_downloads, active: fileIsActive(data) }, { headers: { "Cache-Control": "no-store" } });
          }
        } catch {
          return Response.json({ error: "File status is temporarily unavailable" }, { status: 503 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("shared_files")
          .select("code,file_name,size_bytes,created_at,expires_at,downloads,max_downloads")
          .eq("code", code)
          .maybeSingle();
        if (!data) return Response.json({ error: "File not found" }, { status: 404 });
        return Response.json({ ...data, server_now: new Date().toISOString(), used_up: data.max_downloads != null && data.downloads >= data.max_downloads, active: fileIsActive(data) }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
