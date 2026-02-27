import { execSync } from "child_process";

console.log("Running pnpm install --no-frozen-lockfile...");
execSync("pnpm install --no-frozen-lockfile", {
  cwd: "/vercel/share/v0-project",
  stdio: "inherit",
});
console.log("Lockfile regenerated successfully.");
