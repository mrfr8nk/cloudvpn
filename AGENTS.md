<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Download access checks live in a pure shared module and an atomic service-role-only database claim, so blocked requests never consume limits and concurrent requests cannot bypass them.
- Legacy download claims delegate to the strict import claim and routes accept only a new claim; compatibility paths must never grant free retries.
- Set new file expiry from the database insert clock and display remaining time relative to server time, avoiding upload latency and device clock skew.
- Each download slot is claimed by one device (identified by importing-app user agent, not IP) via the per-device claim function and every import, including repeats by the same phone, consumes a slot, because mobile IPs rotate and the owner wants limits enforced exactly.
- Registration is closed by the existing auth lifecycle trigger; never automatically assign admin roles again, preserving existing admins without reopening first-user escalation.
- New files use server-encrypted CDN objects and MongoDB records; never expose CDN URLs or encryption material, because the CDN serves public objects.
- MongoDB imports use a single conditional findOneAndUpdate with database time and increment; fetch and decrypt before claiming so unavailable files do not consume limits.
- Keep existing Cloud authentication and legacy file reads; authorize admin access before accessing external records or decrypting files.
