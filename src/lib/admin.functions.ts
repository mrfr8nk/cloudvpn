import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

export const listAllFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listExternalFiles } = await import("@/lib/external-storage.server");
    const external = await listExternalFiles();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("shared_files")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return external;
    return [...external, ...(data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

export const adminSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string; name: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.path.startsWith("mongo:")) {
      const { getExternalFile, readExternalBytes } = await import("@/lib/external-storage.server");
      const row = await getExternalFile(data.path.slice(6));
      if (!row) throw new Error("File not found");
      const bytes = await readExternalBytes(row);
      return { url: `data:application/octet-stream;base64,${Buffer.from(bytes).toString("base64")}` };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.storage
      .from("files")
      .createSignedUrl(data.path, 60, { download: data.name });
    if (error) throw new Error(error.message);
    return { url: s.signedUrl };
  });

export const listDownloadLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getExternalFile, listExternalLogs } = await import("@/lib/external-storage.server");
    if (await getExternalFile(data.code)) return listExternalLogs(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("download_logs")
      .select("*")
      .eq("code", data.code)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows;
  });
