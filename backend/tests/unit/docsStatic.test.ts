import fs from "fs";
import path from "path";
import { resolveDocsDir } from "../../src/middleware/docsStatic";

describe("docsStatic", () => {
  it("resolves the presentation HTML on disk", () => {
    const dir = resolveDocsDir();
    expect(fs.existsSync(path.join(dir, "presentation.html"))).toBe(true);
  });
});
