import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch {
          const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
      className={`copy-btn ${done ? "copy-btn-done" : ""}`}
      aria-label="Copy link"
    >
      <span className="relative z-10 flex items-center gap-1.5">
        {done ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="check-pop"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        )}
        {done ? "Copied!" : "Copy"}
      </span>
    </button>
  );
}
