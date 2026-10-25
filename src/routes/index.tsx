import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { CopyButton } from "@/components/CopyButton";
import { ImportFAQ } from "@/components/ImportFAQ";

const SITE = "https://cloudvpn.mrfrankofc.com";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mr Frank Cloud Config — Share .hc files with short links" },
      { name: "description", content: "Upload .hc config files and get a short link that downloads instantly. Links expire after 30 minutes." },
      { property: "og:title", content: "Mr Frank Cloud Config — Short links for .hc files" },
      { property: "og:description", content: "Upload, share, instant download. Every link expires after 30 minutes." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: SITE }],
  }),
  component: Index,
});

type Item = { code: string; name: string; expiresAt: number; max: number | null };

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  return now;
}

function fmtLeft(ms: number) {
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}:${String(s).padStart(2, "0")} left`;
}

function Index() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [expiry, setExpiry] = useState<string>("30");
  const [customExp, setCustomExp] = useState("");
  const [customUnit, setCustomUnit] = useState("60");
  const [limit, setLimit] = useState<string>("1");
  const [custom, setCustom] = useState("");
  const [origin, setOrigin] = useState(SITE);
  const now = useNow();

  useEffect(() => setOrigin(window.location.origin), []);

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) { setError("File too large (max 5MB)"); return; }
    setBusy(true); setError(null); setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const md = limit === "custom" ? custom : limit;
      fd.append("maxDownloads", md);
      const exMin = expiry === "custom" ? Number(customExp) * Number(customUnit) : Number(expiry);
      fd.append("expiresMinutes", String(exMin || 30));
      const json = await new Promise<{ code?: string; expires_at?: string; server_now?: string; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/public/upload");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          try {
            const j = JSON.parse(xhr.responseText);
            if (xhr.status >= 400) reject(new Error(j.error || "Upload failed")); else resolve(j);
          } catch { reject(new Error("Upload failed")); }
        };
        xhr.onerror = () => reject(new Error("Network error, try again"));
        xhr.send(fd);
      });
      if (!json.code || !json.expires_at || !json.server_now) throw new Error("Upload response incomplete; try again");
      const item = { code: json.code, name: file.name, expiresAt: Date.now() + new Date(json.expires_at).getTime() - new Date(json.server_now).getTime(), max: Number(md) >= 1 ? Math.floor(Number(md)) : null };
      setItems((p) => [item, ...p]);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Shell>
      <section className="mx-auto max-w-2xl px-4 pb-10 pt-14 text-center sm:pt-20">
        <p className="mb-5 inline-block rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
          Upload → short link → instant download
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Share your configs<br /><span className="text-primary">in one short link.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground">
          Drop a .hc file and get a link like <span className="font-mono text-foreground">/abcd12</span>. It downloads straight away and expires when you choose.
        </p>

        <div className="mt-8 rounded-[2rem] glass p-5 text-left">
          <p className="text-sm font-medium">Expires after</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[["5","5 min"],["15","15 min"],["30","30 min"],["60","1 hour"],["360","6 hours"],["1440","1 day"],["10080","7 days"],["custom","Custom"]].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setExpiry(v ?? "30")}
                className={`rounded-full px-4 py-1.5 text-sm transition ${expiry === v ? "bg-primary text-primary-foreground shadow-glow" : "glass-input"}`}>{l}</button>
            ))}
            {expiry === "custom" && (
              <div className="flex gap-2">
                <input type="number" min={1} value={customExp} onChange={(e) => setCustomExp(e.target.value)} placeholder="e.g. 2"
                  className="w-20 rounded-full glass-input px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className="rounded-full glass-input px-3 py-1.5 text-sm outline-none">
                  <option value="1">minutes</option><option value="60">hours</option><option value="1440">days</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-[2rem] glass p-5 text-left">
          <p className="text-sm font-medium">Download limit</p>
          <p className="text-xs text-muted-foreground">Burn after 1 is the default. The link stops working after this many downloads (or when it expires).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[["0","Unlimited"],["1","🔥 Burn after 1"],["2","2"],["3","3"],["4","4"],["5","5"],["custom","Custom"]].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setLimit(v ?? "1")}
                className={`rounded-full px-4 py-1.5 text-sm transition ${limit === v ? "bg-primary text-primary-foreground shadow-glow" : "glass-input"}`}>{l}</button>
            ))}
            {limit === "custom" && (
              <input type="number" min={1} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. 10"
                className="w-24 rounded-full glass-input px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
            )}
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          onClick={() => !busy && inputRef.current?.click()}
          className={`mt-4 cursor-pointer rounded-[2rem] glass-strong p-10 transition-all ${drag ? "scale-[1.02] ring-2 ring-primary" : "hover:scale-[1.01]"}`}
        >
          <input ref={inputRef} type="file" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-glow">↑</div>
          <p className="font-medium">{busy ? `Uploading ${progress}%` : "Tap or drop your .hc file"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Max 5MB</p>
          {busy && (
            <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {items.length > 0 && (
          <ul className="mt-6 space-y-3 text-left">
            {items.map((it) => {
              const left = it.expiresAt - now;
              const link = `${origin}/${it.code}`;
              return (
                <li key={it.code} className="flex items-center gap-3 rounded-2xl glass p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">{it.name} · <span className={left > 0 ? "text-success" : "text-destructive"}>{fmtLeft(left)}</span>{it.max ? ` · ${it.max === 1 ? "🔥 burns after 1 download" : `${it.max} downloads max`}` : ""}</p>
                    <a href={`/${it.code}`} className="block truncate font-mono text-primary">{link}</a>
                  </div>
                  <CopyButton text={link} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <StatusChecker />
      <ImportFAQ />

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3">
        {[
          ["01", "Upload", "Drop any .hc config file."],
          ["02", "Share", "Get a 6-character short link."],
          ["03", "Expires", "You choose when the link dies."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-3xl glass p-6">
            <p className="font-mono text-sm text-primary">{n}</p>
            <h3 className="mt-2 font-display text-lg font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </Shell>
  );
}

type Status = { file_name: string; size_bytes: number; created_at: string; expires_at: string; server_now: string; downloads: number; max_downloads: number | null; used_up: boolean; active: boolean };

function StatusChecker() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const now = useNow();

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch(`/api/public/status?code=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Not found");
      setClockOffset(new Date(j.server_now).getTime() - Date.now());
      setRes(j);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }

  const left = res ? (res.used_up ? 0 : new Date(res.expires_at).getTime() - now - clockOffset) : 0;

  return (
    <section className="mx-auto max-w-2xl px-4 py-6">
      <div className="rounded-[2rem] glass p-6">
        <h2 className="font-display text-xl font-semibold">Check file status</h2>
        <p className="mt-1 text-sm text-muted-foreground">Paste a link or code to see if it's still active.</p>
        <form onSubmit={check} className="mt-4 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="abcd12 or full link"
            className="min-w-0 flex-1 rounded-full glass-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <button className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90" disabled={loading}>
            {loading ? "…" : "Check"}
          </button>
        </form>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        {res && (
          <div className="mt-4 rounded-2xl glass-input p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{res.file_name}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${left > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {left > 0 ? "Active" : res.used_up ? "Used up" : "Expired"}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              {left > 0 ? fmtLeft(left) : res.used_up ? "Download limit reached" : `Expired ${new Date(res.expires_at).toLocaleString()}`} · {(res.size_bytes / 1024).toFixed(1)} KB · {res.downloads}{res.max_downloads ? `/${res.max_downloads}` : ""} downloads
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
