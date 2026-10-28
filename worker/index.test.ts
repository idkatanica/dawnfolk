import { describe, expect, it, vi } from "vitest";
import worker, { byteRangeOf, homeAddressOf } from "./index.ts";

function assetsReturning(body: string) {
  return { fetch: vi.fn(() => Promise.resolve(new Response(body))) };
}

describe("worker", () => {
  it("serves the game on its own domain", async () => {
    const assets = assetsReturning("game");

    const response = await worker.fetch(new Request("https://playdawnfolk.com/?seed=7"), { ASSETS: assets });

    expect(await response.text()).toBe("game");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("sends the old address to the domain with the path and query kept", async () => {
    const assets = assetsReturning("game");

    const response = await worker.fetch(new Request("https://dawnfolk.svidskiy.workers.dev/?seed=7&shape=round"), {
      ASSETS: assets,
    });

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("https://playdawnfolk.com/?seed=7&shape=round");
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("serves a part of a film when asked for a range", async () => {
    const assets = assetsReturning("0123456789");

    const response = await worker.fetch(
      new Request("https://playdawnfolk.com/media/wide.mp4", { headers: { Range: "bytes=2-5" } }),
      { ASSETS: assets }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(await response.text()).toBe("2345");
  });

  it("offers ranges on a whole film", async () => {
    const response = await worker.fetch(new Request("https://playdawnfolk.com/media/wide.mp4"), {
      ASSETS: assetsReturning("0123456789"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(await response.text()).toBe("0123456789");
  });

  it("refuses a range past the end of a film", async () => {
    const response = await worker.fetch(
      new Request("https://playdawnfolk.com/media/wide.mp4", { headers: { Range: "bytes=20-" } }),
      { ASSETS: assetsReturning("0123456789") }
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */10");
  });

  it("reads open and suffix ranges", () => {
    expect(byteRangeOf("bytes=0-", 10)).toEqual({ end: 9, start: 0 });
    expect(byteRangeOf("bytes=0-1", 10)).toEqual({ end: 1, start: 0 });
    expect(byteRangeOf("bytes=4-99", 10)).toEqual({ end: 9, start: 4 });
    expect(byteRangeOf("bytes=-3", 10)).toEqual({ end: 9, start: 7 });
    expect(byteRangeOf("bytes=0-1,4-5", 10)).toBeNull();
  });

  it("drops the www prefix", () => {
    expect(homeAddressOf(new Request("https://www.playdawnfolk.com/manifest.webmanifest"))).toBe(
      "https://playdawnfolk.com/manifest.webmanifest"
    );
  });
});
