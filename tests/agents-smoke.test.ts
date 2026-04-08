import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const agentsDir = path.join(process.cwd(), "agents");

describe("agent scripts", () => {
  it("contains the chapter entrypoints", () => {
    const files = fs.readdirSync(agentsDir).filter((fileName) => fileName.endsWith(".ts") && fileName !== "_runtime.ts");
    assert.ok(files.length >= 20);
    assert.ok(files.includes("s01_agent_loop.ts"));
    assert.ok(files.includes("s19_mcp_plugin.ts"));
    assert.ok(files.includes("s_full.ts"));
  });
});
