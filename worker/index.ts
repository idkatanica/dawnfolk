const HOME_HOST = "playdawnfolk.com";
const MEDIA_PREFIX = "/media/";
const RANGE_PATTERN = /^bytes=(\d+)-(\d*)$/;

interface WorkerEnvironment {
  readonly ASSETS: { readonly fetch: (request: Request) => Promise<Response> };
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

async function serveRange(request: Request, assets: WorkerEnvironment["ASSETS"]): Promise<Response> {
  const response = await assets.fetch(request);
  const rangeHeader = request.headers.get("Range");
  const match = rangeHeader === null ? null : RANGE_PATTERN.exec(rangeHeader);
  const headers = new Headers(response.headers);

  headers.set("Accept-Ranges", "bytes");

  if (!response.ok || match === null) {
    return new Response(response.body, { headers, status: response.status });
  }

  const body = await response.arrayBuffer();
  const start = Number(match[1]);
  const end = match[2] === "" ? body.byteLength - 1 : Math.min(Number(match[2]), body.byteLength - 1);

  if (start > end) {
    return new Response(body, { headers });
  }

  headers.set("Content-Range", `bytes ${start}-${end}/${body.byteLength}`);
  headers.set("Content-Length", String(end - start + 1));

  return new Response(body.slice(start, end + 1), { headers, status: 206 });
}

export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    const homeAddress = homeAddressOf(request);

    if (homeAddress !== null) {
      return Promise.resolve(Response.redirect(homeAddress, 301));
    }

    if (new URL(request.url).pathname.startsWith(MEDIA_PREFIX)) {
      return serveRange(request, environment.ASSETS);
    }

    return environment.ASSETS.fetch(request);
  },
};
