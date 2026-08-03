import { defineConfig } from "drizzle-kit";

process.loadEnvFile();

const dbURL = process.env.DB_URL;

if (!dbURL) {
  throw new Error("DB_URL environment variable is missing");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbURL,
  },
});