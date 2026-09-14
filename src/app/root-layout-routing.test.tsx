import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), getOnboardingState: vi.fn() }));

vi.mock("@/server/auth", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/server/onboarding", () => ({ getOnboardingState: mocks.getOnboardingState }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({}) }));
vi.mock("@/components/admin-route-gate", () => ({ AdminRouteGate: ({ children }: { children: React.ReactNode }) => <div data-gate="admin">{children}</div> }));
vi.mock("@/components/onboarding-gate", () => ({ OnboardingGate: ({ children }: { children: React.ReactNode }) => <div data-gate="onboarding">{children}</div> }));
vi.mock("@serwist/turbopack/react", () => ({ SerwistProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/offline-provider", () => ({ OfflineProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/rest-timer-provider", () => ({ RestTimerProvider: ({ children }: { children: React.ReactNode }) => children }));

import RootLayout from "@/app/layout";

describe("root layout role boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts an ADMIN behind the admin route gate without loading user onboarding", async () => {
    mocks.currentUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com", role: "ADMIN" });

    const markup = renderToStaticMarkup(await RootLayout({ children: <main>Admin content</main> }));

    expect(markup).toContain('data-gate="admin"');
    expect(markup).not.toContain('data-gate="onboarding"');
    expect(mocks.getOnboardingState).not.toHaveBeenCalled();
  });
});
