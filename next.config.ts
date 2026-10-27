import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// ponytail: no cacheComponents — every screen is per-user and dynamic.
const nextConfig: NextConfig = {
  agentRules: false, // CLAUDE.md is the agent file; don't let `next dev` write AGENTS.md
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Reads src/i18n/request.ts (locale per request, no locale prefix in URLs).
export default createNextIntlPlugin()(nextConfig);
