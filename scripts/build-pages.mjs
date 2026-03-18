import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const npmExecPath = process.env.npm_execpath;

if (!npmExecPath) {
  throw new Error("npm_execpath is not available.");
}

const projectsRoutePath = path.join(process.cwd(), "app", "api", "projects", "route.ts");
const projectByIdRoutePath = path.join(
  process.cwd(),
  "app",
  "api",
  "projects",
  "[id]",
  "route.ts"
);

const staticProjectsRouteStub = `import { githubPagesUnavailableResponse } from "@/lib/apiRouteUtils";

export const dynamic = "force-static";

export async function GET() {
  return githubPagesUnavailableResponse();
}

export async function POST() {
  return githubPagesUnavailableResponse();
}
`;

const staticProjectByIdRouteStub = `import { githubPagesUnavailableResponse } from "@/lib/apiRouteUtils";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ id: "1" }];
}

export async function GET() {
  return githubPagesUnavailableResponse();
}

export async function PATCH() {
  return githubPagesUnavailableResponse();
}

export async function PUT() {
  return githubPagesUnavailableResponse();
}

export async function DELETE() {
  return githubPagesUnavailableResponse();
}
`;

const originals = new Map([
  [projectsRoutePath, readFileSync(projectsRoutePath, "utf8")],
  [projectByIdRoutePath, readFileSync(projectByIdRoutePath, "utf8")],
]);

writeFileSync(projectsRoutePath, staticProjectsRouteStub, "utf8");
writeFileSync(projectByIdRoutePath, staticProjectByIdRouteStub, "utf8");

let buildResult;

try {
  buildResult = spawnSync(process.execPath, [npmExecPath, "run", "build:pages:next"], {
    stdio: "inherit",
    env: {
      ...process.env,
      GITHUB_PAGES: "true",
      NODE_ENV: "production",
    },
  });
} finally {
  for (const [filePath, content] of originals.entries()) {
    writeFileSync(filePath, content, "utf8");
  }
}

if (!buildResult) {
  throw new Error("Failed to execute build process.");
}

if (buildResult.error) {
  throw buildResult.error;
}

if (typeof buildResult.status === "number") {
  process.exitCode = buildResult.status;
} else {
  process.exitCode = 1;
}