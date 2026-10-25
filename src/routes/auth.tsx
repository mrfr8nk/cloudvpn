import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "@/components/Shell";
import { CopyButton } from "@/components/CopyButton";
import { listAllFiles, checkIsAdmin, adminSignedUrl, listDownloadLogs } from "@/lib/admin.functions";
import { fileIsActive } from "@/lib/download-security";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin — Mr Frank Cloud Config" },
      { name: "description", content: "Admin portal for Mr Frank Cloud Config." },
      { property: "og:title", content: "Admin — Mr Frank Cloud Config" },
      { property: "og:description", content: "Admin portal for Mr Frank Cloud Config." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-4 py-12">
        {session === null ? null : session ? <AdminGate /> : <LoginForm />}
      </div>
    </Shell>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm rounded-[2rem] glass-strong p-8">
      <h1 className="font-display text-2xl font-semibold">Admin sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Restricted area.</p>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
        className="mt-6 w-full rounded-full glass-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
      <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
        className="mt-3 w-full rounded-full glass-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
      <button disabled={loading} className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-glow">
        {loading ? "…" : "Sign in"}
      </button>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}

function AdminGate() {
  const check = useServerFn(checkIsAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => check() });
  if (isLoading) return <p className="text-center text-muted-foreground">Loading…</p>;
  if (!data?.isAdmin)
    return (
      <div className="mx-auto max-w-sm rounded-[2rem] glass p-8 text-center">
        <p className="font-medium">This account is not an admin.</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-4 text-sm text-primary">Sign out</button>
      </div>
    );
  return <AdminPanel />;
}

function AdminPanel() {
  const list = useServerFn(listAllFiles);
  const sign = useServerFn(adminSignedUrl);
  const { data = [], isLoading, refetch } = useQuery({ queryKey: ["allFiles"], queryFn: () => list() });
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const now = Date.now();
  const rows = data.filter((f) => {
    const active = fileIsActive(f, now);
    return filter === "all" || (filter === "active" ? active : !active);
  });
  const activeCount = data.filter((f) => fileIsActive(f, now)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">All files</h1>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="rounded-full glass px-4 py-2 text-sm">Refresh</button>
          <button onClick={() => supabase.auth.signOut()} className="rounded-full glass px-4 py-2 text-sm">Sign out</button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[["Total", data.length], ["Active", activeCount], ["Expired", data.length - activeCount]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl glass p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="font-display text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        {(["all", "active", "expired"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm capitalize ${filter === f ? "bg-primary text-primary-foreground" : "glass"}`}>{f}</button>
        ))}
      </div>
      {isLoading ? <p className="mt-6 text-muted-foreground">Loading…</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((f) => {
            const active = new Date(f.expires_at).getTime() > now && !(f.max_downloads != null && f.downloads >= f.max_downloads);
            const link = `${window.location.origin}/${f.code}`;
            return (
              <li key={f.code} className="flex flex-wrap items-center gap-3 rounded-2xl glass p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{f.file_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{active ? "Active" : "Expired"}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-primary">{link}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(f.size_bytes / 1024).toFixed(1)} KB · {f.downloads}{f.max_downloads ? `/${f.max_downloads}` : ""} downloads · uploaded {new Date(f.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const { url } = await sign({ data: { path: f.storage_path, name: f.file_name } });
                    const a = document.createElement("a"); a.href = url; a.download = f.file_name; a.click();
                  }}
                  className="rounded-full glass px-4 py-2 text-sm">Download</button>
                <CopyButton text={link} />
                <Logs code={f.code} />
              </li>
            );
          })}
          {rows.length === 0 && <p className="text-muted-foreground">No files.</p>}
        </ul>
      )}
    </div>
  );
}

function Logs({ code }: { code: string }) {
  const fetchLogs = useServerFn(listDownloadLogs);
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["logs", code], enabled: open, queryFn: () => fetchLogs({ data: { code } }),
  });
  return (
    <div className="w-full">
      <button onClick={() => setOpen(!open)} className="text-xs text-primary">{open ? "Hide" : "Show"} access log</button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && data.length === 0 && <p className="text-xs text-muted-foreground">No attempts yet.</p>}
          {data.map((l) => (
            <div key={l.id} className="rounded-xl glass-input p-2 text-xs">
              <span className={`mr-2 font-semibold ${l.allowed ? "text-success" : "text-destructive"}`}>{l.allowed ? "Allowed" : "Blocked"}</span>
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}{l.reason ? ` · ${l.reason}` : ""}</span>
              <p className="mt-1 break-all font-mono">{l.user_agent || "(no user agent)"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
