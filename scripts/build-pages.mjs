import { spawnSync } from "node:child_process";

const npmExecPath = process.env.npm_execpath;

if (!npmExecPath) {
  throw new Error("npm_execpath is not available.");
}

const buildResult = spawnSync(process.execPath, [npmExecPath, "run", "build:pages:next"], {
  stdio: "inherit",
  env: {
    ...process.env,
    GITHUB_PAGES: "true",
    NODE_ENV: "production",
  },
});

if (buildResult.error) {
  throw buildResult.error;
}

if (typeof buildResult.status === "number") {
  process.exitCode = buildResult.status;
} else {
  process.exitCode = 1;
}