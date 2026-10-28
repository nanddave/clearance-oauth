import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { listGuides } from "./guides";
import { managedScript, setupScript } from "./kits";

// The copy-paste scripts are the step that proves a connection works: type-check them against the real SDK.
describe("Composio scripts", () => {
  it("type-check against @composio/core", () => {
    const dir = join(process.cwd(), "node_modules/.cache/kits-check"); // inside the project so @composio/core resolves
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const files = listGuides().flatMap((g) =>
      [["setup", setupScript(g)], ["managed", managedScript(g)]].map(([kind, text]) => {
        const f = join(dir, `${g.slug}-${kind}.ts`);
        writeFileSync(f, text);
        return f;
      }),
    );
    const program = ts.createProgram(files, {
      noEmit: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      types: ["node"],
      skipLibCheck: true,
    });
    const errors = ts.getPreEmitDiagnostics(program).map((d) => `${d.file?.fileName.split("/").pop()}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
    expect(errors).toEqual([]);
  }, 30_000);
});
