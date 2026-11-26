import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const plist = readFileSync(new URL("../ios/App/App/Info.plist", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");

test("iOS explains camera use for barcode scanning and says pictures stay on the device", () => {
  assert.match(plist, /<key>NSCameraUsageDescription<\/key>/);
  assert.match(
    plist,
    /<string>Future Star uses the camera to scan food barcodes\. Pictures are not saved or uploaded\.<\/string>/,
  );
});

test("Android requests the camera without requiring one", () => {
  assert.match(manifest, /<uses-permission android:name="android\.permission\.CAMERA" \/>/);
  assert.match(
    manifest,
    /<uses-feature android:name="android\.hardware\.camera" android:required="false" \/>/,
  );
});
