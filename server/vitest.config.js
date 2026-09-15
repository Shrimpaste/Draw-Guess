import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { DATABASE_PATH: ":memory:", ADMIN_KEY: "test-admin-key" },
  },
});
