#!/usr/bin/env node
/**
 * Local USDA catalog tables were removed. Nutrition search uses the FDC API.
 *   FDC_API_KEY in .env  —  https://api.data.gov/signup/
 */
console.error(
  "USDA catalog tables were removed. Nutrition search uses the FDC API (set FDC_API_KEY).",
);
process.exit(1);
