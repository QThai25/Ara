import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseVariables = ["MONGODB_URI", "MONGO_URI", "DATABASE_URL"];
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

for (const name of databaseVariables) {
  const raw = String(process.env[name] || "").trim();
  if (!raw) continue;
  let hostname;
  try { hostname = new URL(raw).hostname; }
  catch { throw new Error(`Test bị dừng: ${name} không phải URI database test hợp lệ.`); }
  if (!localHosts.has(hostname)) {
    throw new Error(`Test bị dừng: ${name} đang trỏ tới host external. Chỉ database test local/cô lập được phép.`);
  }
}

const directory = path.dirname(fileURLToPath(import.meta.url));
process.env.DOTENV_CONFIG_PATH = path.join(directory, ".env.test.disabled");
process.env.NODE_ENV = "test";
process.env.ARA_DISABLE_SCHEDULERS = "true";
process.env.PAYOS_ENABLED = "false";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ara_test_isolated";
