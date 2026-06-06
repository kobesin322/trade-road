import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent repo has an extra lockfile; keep chunk tracing scoped to this app.
  outputFileTracingRoot: appRoot,
};

export default nextConfig;
