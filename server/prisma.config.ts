/**
 * Prisma 7 configuration.
 *
 * The schema no longer carries a connection URL: migrations read it from here,
 * and the runtime client gets a `pg` Pool through @prisma/adapter-pg instead.
 * One place to change the connection, two consumers.
 */
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
