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

import { parseConfig, writePublicConfig } from "./parseConfig.js";

const config = parseConfig(process.argv.slice(2));
const configPath = writePublicConfig(config);
console.log(`[generate-config] Wrote ${configPath}`);
