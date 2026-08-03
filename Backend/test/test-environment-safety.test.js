import assert from "node:assert/strict";
import test from "node:test";

test("test process is isolated from external database and production schedulers", () => {
  const database = new URL(process.env.MONGODB_URI);
  assert.ok(["localhost", "127.0.0.1", "[::1]", "::1"].includes(database.hostname));
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.ARA_DISABLE_SCHEDULERS, "true");
  assert.equal(process.env.PAYOS_ENABLED, "false");
  assert.match(process.env.DOTENV_CONFIG_PATH, /\.env\.test\.disabled$/);
});
