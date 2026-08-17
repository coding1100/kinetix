import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "production";
  }
}

function generateVersionFile() {
  const gitSha = getGitSha();
  const timestamp = Date.now();
  const buildId = `${gitSha}-${timestamp}`;
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const versionData = {
    version: pkg.version || "0.1.3",
    buildId,
    gitSha,
    timestamp: new Date().toISOString(),
  };

  const publicDir = path.resolve(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const versionFilePath = path.join(publicDir, "version.json");
  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2), "utf8");
  console.log(`[build] Generated public/version.json with buildId: ${buildId}`);
}

generateVersionFile();
