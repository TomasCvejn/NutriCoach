import type { NextConfig } from "next";

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

export default nextConfig;
