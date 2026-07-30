import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { User } from "../src/models/User.js";

const apply = process.argv.includes("--apply");
const dryRun = !apply;

if (apply && process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_RBAC_MIGRATION !== "true") {
  throw new Error("Refusing production apply. Run dry-run on a staging copy first and explicitly set ALLOW_PRODUCTION_RBAC_MIGRATION=true.");
}

await connectMongo();
try {
  const collection = User.collection;
  const [legacyAdmins, activeOwners, staff, invalidRoles] = await Promise.all([
    collection.find({ role: "admin" }, { projection: { _id: 1, email: 1, status: 1 } }).toArray(),
    collection.countDocuments({ role: { $in: ["owner", "admin"] }, status: "active" }),
    collection.countDocuments({ role: "staff" }),
    collection.find(
      { role: { $nin: ["customer", "admin", "owner", "staff"] } },
      { projection: { _id: 1, role: 1, status: 1 } }
    ).toArray()
  ]);

  const summary = {
    mode: dryRun ? "dry-run" : "apply",
    legacyAdmins: legacyAdmins.length,
    activeOwnersAfterMigration: activeOwners,
    staff,
    invalidRoles: invalidRoles.length,
    updated: 0
  };

  if (activeOwners < 1) {
    throw new Error("Migration aborted: no active legacy admin/owner would remain as an active owner.");
  }

  for (const account of legacyAdmins) {
    console.log(JSON.stringify({
      accountId: String(account._id),
      maskedEmail: String(account.email || "").replace(/^(.{1,2}).*(@.*)$/, "$1***$2"),
      status: account.status,
      change: "admin -> owner"
    }));
  }
  for (const account of invalidRoles) {
    console.warn(JSON.stringify({
      accountId: String(account._id),
      role: account.role,
      status: account.status,
      issue: "invalid_role_requires_manual_review"
    }));
  }

  if (apply && legacyAdmins.length) {
    const result = await collection.updateMany(
      { role: "admin" },
      { $set: { role: "owner", updatedAt: new Date() }, $inc: { tokenVersion: 1 } }
    );
    summary.updated = result.modifiedCount;
  }

  console.log(JSON.stringify({ summary }, null, 2));
} finally {
  await mongoose.disconnect();
}
