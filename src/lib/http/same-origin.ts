export class RequestPolicyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RequestPolicyError";
  }
}

function expectedOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || requestUrl.host;
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

export function assertSameOriginJson(request: Request): void {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType?.startsWith("application/json")) {
    throw new RequestPolicyError("Content-Type must be application/json", 415);
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new RequestPolicyError("Cross-origin requests are not allowed", 403);
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null" || origin !== expectedOrigin(request)) {
    throw new RequestPolicyError("A matching Origin header is required", 403);
  }
}
