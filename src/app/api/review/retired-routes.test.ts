import { expect, it } from "vitest";
import { GET } from "./report/route";
import { POST as preview } from "./import/preview/route";
import { POST as apply } from "./import/apply/route";
it("denies all retired user report and programme mutation endpoints", async () => {
  for (const handler of [GET, preview, apply]) expect((await handler()).status).toBe(403);
});
