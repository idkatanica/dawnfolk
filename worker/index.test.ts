import { describe, expect, it, vi } from "vitest";
import worker, { homeAddressOf } from "./index.ts";

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

  it("drops the www prefix", () => {
    expect(homeAddressOf(new Request("https://www.playdawnfolk.com/manifest.webmanifest"))).toBe(
      "https://playdawnfolk.com/manifest.webmanifest"
    );
  });
});
