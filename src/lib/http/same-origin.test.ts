import { describe, expect, it } from "vitest";

import { assertSameOriginJson, RequestPolicyError } from "@/lib/http/same-origin";

function makeRequest(headers: HeadersInit = {}) {
  return new Request("https://gym.example.test/api/example", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      origin: "https://gym.example.test",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
}

describe("assertSameOriginJson", () => {
  it("accepts same-origin JSON", () => {
    expect(() => assertSameOriginJson(makeRequest())).not.toThrow();
  });

  it("rejects a cross-origin mutation", () => {
    expect(() =>
      assertSameOriginJson(makeRequest({ origin: "https://attacker.example" })),
    ).toThrow(RequestPolicyError);
  });

  it("rejects non-JSON content", () => {
    expect(() => assertSameOriginJson(makeRequest({ "content-type": "text/plain" }))).toThrow(
      "application/json",
    );
  });

  it("honours trusted reverse-proxy origin headers", () => {
    const request = makeRequest({
      host: "app:3000",
      origin: "https://gym.example.test",
      "x-forwarded-host": "gym.example.test",
      "x-forwarded-proto": "https",
    });

    expect(() => assertSameOriginJson(request)).not.toThrow();
  });

  it("uses the configured public origin when a proxy reports an internal host", () => {
    const previous = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://gym.example.test";

    try {
      expect(() => assertSameOriginJson(makeRequest({
        host: "vicgym:3000",
        "x-forwarded-host": "coolify-proxy:443",
        "x-forwarded-proto": "http",
      }))).not.toThrow();
    } finally {
      if (previous === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = previous;
    }
  });
});
