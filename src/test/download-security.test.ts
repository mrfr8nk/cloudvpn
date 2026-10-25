import { describe, expect, it } from "vitest";
import { blockedDownloadReason, decideClaim, fileIsActive, importerHash } from "@/lib/download-security";

describe("Download access", () => {
  it.each(["curl/8.23.0", "Wget/1.21", "Termux", "python-requests/2.32", "TelegramBot", "", "Mozilla/5.0 Chrome/154"])("blocks %s", (ua) => {
    expect(blockedDownloadReason(new Headers({ "user-agent": ua }))).not.toBeNull();
  });
  it("permits the Android import client observed in real access logs", () => {
    expect(blockedDownloadReason(new Headers({ "user-agent": "Dalvik/2.1.0 (Linux; U; Android 16; SM-A346E Build/BP4A.251205.006)" }))).toBeNull();
  });
  it("blocks browser metadata even when its app identity is spoofed", () => {
    expect(blockedDownloadReason(new Headers({ "user-agent": "okhttp/4.9.0", "sec-fetch-mode": "navigate" }))).not.toBeNull();
  });
  it("identifies a device by phone/app, so a changed mobile network is still the same device", async () => {
    const phone = "Dalvik/2.1.0 (Linux; U; Android 12; SM-G975W Build/SP1A.210812.016)";
    expect(await importerHash(phone)).toBe(await importerHash(phone));
    expect(await importerHash("Dalvik/2.1.0 (Linux; U; Android 10; itel P651W Build/QP1A.190711.020)")).not.toBe(await importerHash(phone));
  });
  const t0 = Date.UTC(2026, 9, 19);
  const live = new Date(t0 + 30 * 60000).toISOString();
  it("a 5-download link lets a second, different device import", () => {
    expect(decideClaim({ expires_at: live, downloads: 1, max_downloads: 5 }, t0 + 60000)).toBe("new");
  });
  it("burn-after-1 blocks a second device", () => {
    expect(decideClaim({ expires_at: live, downloads: 1, max_downloads: 1 }, t0 + 60000)).toBe("used_up");
  });
  it("burn-after-1 blocks the same phone importing a second time", () => {
    expect(decideClaim({ expires_at: live, downloads: 1, max_downloads: 1 }, t0 + 60000)).toBe("used_up");
  });
  it.each([2, 3, 4, 5])("allows exactly %i imports, without free repeats", (max) => {
    for (let downloads = 0; downloads < max; downloads++) {
      expect(decideClaim({ expires_at: live, downloads, max_downloads: max }, t0 + 60000)).toBe("new");
    }
    expect(decideClaim({ expires_at: live, downloads: max, max_downloads: max }, t0 + 60000)).toBe("used_up");
  });
  it("nothing works once the link has expired", () => {
    expect(decideClaim({ expires_at: live, downloads: 0, max_downloads: 5 }, t0 + 30 * 60000)).toBe("expired");
  });
  it("keeps an undownloaded 30-minute link active at one minute", () => {
    const start = Date.UTC(2026, 9, 19);
    const file = { expires_at: new Date(start + 30 * 60000).toISOString(), downloads: 0, max_downloads: 1 };
    expect(fileIsActive(file, start + 60000)).toBe(true);
    expect(fileIsActive(file, start + 30 * 60000)).toBe(false);
  });
  it("makes burn-after-1 unavailable after one allowed transfer", () => {
    expect(fileIsActive({ expires_at: "2099-01-01T00:00:00Z", downloads: 1, max_downloads: 1 })).toBe(false);
  });
});