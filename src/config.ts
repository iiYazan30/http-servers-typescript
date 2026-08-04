import type { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile();

export type APIConfig = {
  fileserverHits: number;
  platform: string;
};

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};

export type Config = {
  api: APIConfig;
  db: DBConfig;
};

export const config: Config = {
  api: {
  fileserverHits: 0,
  platform: envOrThrow("PLATFORM"),
},
  db: {
    url: envOrThrow("DB_URL"),
    migrationConfig: {
      migrationsFolder: "./src/db/migrations",
    },

  },
};

function envOrThrow(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Environment variable ${key} is missing`);
  }

  return value;
}