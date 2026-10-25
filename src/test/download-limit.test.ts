import { describe, expect, it } from "vitest";

import { parseExpiresMinutes, parseMaxDownloads } from "@/lib/download-limit";

describe("Upload limits", () => {
  it("burns after 1 download when no limit is sent", () => {
    expect(parseMaxDownloads(null)).toBe(1);
  });

  it("treats an explicit 0 as unlimited", () => {
    expect(parseMaxDownloads("0")).toBeNull();
  });

  it("keeps a chosen limit and rounds it down", () => {
    expect(parseMaxDownloads("3")).toBe(3);
    expect(parseMaxDownloads("2.9")).toBe(2);
  });

  it("caps the limit at 100000 downloads", () => {
    expect(parseMaxDownloads("999999")).toBe(100000);
  });

  it("expires links after 30 minutes by default", () => {
    expect(parseExpiresMinutes(null)).toBe(30);
    expect(parseExpiresMinutes("120")).toBe(120);
    expect(parseExpiresMinutes("999999")).toBe(43200);
  });
});
