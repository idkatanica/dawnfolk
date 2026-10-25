export const HOME_HOST = "playdawnfolk.com";

interface AssetFetcher {
  readonly fetch: (request: Request) => Promise<Response>;
}

export interface WorkerEnvironment {
  readonly ASSETS: AssetFetcher;
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

export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    const homeAddress = homeAddressOf(request);

    if (homeAddress !== null) {
      return Promise.resolve(Response.redirect(homeAddress, 301));
    }

    return environment.ASSETS.fetch(request);
  },
};
