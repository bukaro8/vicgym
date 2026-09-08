import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { proxy } from "@/proxy";

describe("route protection", () => {
  it("redirects anonymous page requests to login", () => {
    const response = proxy(new NextRequest("https://gym.example.com/progress?period=8"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://gym.example.com/login?next=%2Fprogress%3Fperiod%3D8");
  });

  it("rejects anonymous API requests and permits requests carrying a session cookie", () => {
    expect(proxy(new NextRequest("https://gym.example.com/api/sync", { method: "POST" })).status).toBe(401);
    const authenticated = new NextRequest("https://gym.example.com/progress", { headers: { cookie: `${AUTH_COOKIE_NAME}=opaque` } });
    expect(proxy(authenticated).headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps login, verification, and health endpoints public", () => {
    expect(proxy(new NextRequest("https://gym.example.com/login")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(new NextRequest("https://gym.example.com/api/auth/verify?token=x")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(new NextRequest("https://gym.example.com/api/health")).headers.get("x-middleware-next")).toBe("1");
  });
});
