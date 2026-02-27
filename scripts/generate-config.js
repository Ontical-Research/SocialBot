#!/usr/bin/env node
/**
 * Write public/config.json from an optional YAML config file.
 *
 * Used by the GitHub Pages CI build to pre-populate the demo agents without
 * starting a dev server.
 *
 * Usage:
 *   node scripts/generate-config.js demo-pages.yaml
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfig } from "./parseConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const { natsUrl, agents } = parseConfig(process.argv.slice(2));

const config = { natsUrl, agents };
const configPath = resolve(projectRoot, "public", "config.json");

writeFileSync(configPath, JSON.stringify(config) + "\n", "utf-8");
console.log(`[generate-config] Wrote ${configPath}`);
