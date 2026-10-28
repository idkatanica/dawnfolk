const HOME_HOST = "playdawnfolk.com";
const MEDIA_PREFIX = "/media/";
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

interface WorkerEnvironment {
  readonly ASSETS: { readonly fetch: (request: Request) => Promise<Response> };
}

interface ByteRange {
  readonly end: number;
  readonly start: number;
}

export function homeAddressOf(request: Request): string | null {
  const url = new URL(request.url);

  if (url.hostname === HOME_HOST || url.hostname === "localhost") {
    return null;
  }

  url.protocol = "https:";
  url.hostname = HOME_HOST;
  url.port = "";

  return url.toString();
}

export function byteRangeOf(header: string, size: number): ByteRange | null {
  const match = RANGE_PATTERN.exec(header.trim());

  if (match === null) {
    return null;
  }

  const [, startText = "", endText = ""] = match;

  if (startText === "") {
    const suffix = Number(endText);

    if (endText === "" || suffix === 0) {
      return null;
    }

    return { end: size - 1, start: Math.max(0, size - suffix) };
  }

  const start = Number(startText);
  const end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);

  if (start >= size || end < start) {
    return null;
  }

  return { end, start };
}

async function servePartially(request: Request, assets: WorkerEnvironment["ASSETS"]): Promise<Response> {
  const response = await assets.fetch(request);
  const rangeHeader = request.headers.get("Range");

  if (!response.ok || rangeHeader === null) {
    const headers = new Headers(response.headers);

    headers.set("Accept-Ranges", "bytes");

    return new Response(response.body, { headers, status: response.status });
  }

  const body = await response.arrayBuffer();
  const range = byteRangeOf(rangeHeader, body.byteLength);
  const headers = new Headers(response.headers);

  headers.set("Accept-Ranges", "bytes");

  if (range === null) {
    headers.set("Content-Range", `bytes */${body.byteLength}`);
    headers.delete("Content-Length");

    return new Response(null, { headers, status: 416 });
  }

  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${body.byteLength}`);
  headers.set("Content-Length", String(range.end - range.start + 1));

  return new Response(body.slice(range.start, range.end + 1), { headers, status: 206 });
}

export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    const homeAddress = homeAddressOf(request);

    if (homeAddress !== null) {
      return Promise.resolve(Response.redirect(homeAddress, 301));
    }

    if (new URL(request.url).pathname.startsWith(MEDIA_PREFIX)) {
      return servePartially(request, environment.ASSETS);
    }

    return environment.ASSETS.fetch(request);
  },
};
