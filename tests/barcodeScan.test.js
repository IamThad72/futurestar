import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { finishBarcodeScan, releaseBarcodeHardware } from "../utils/barcodeScan.js";

function fakeHardware() {
  const controls = { stopped: false, stop() { this.stopped = true; } };
  const track = { stopped: false, stop() { this.stopped = true; } };
  const video = { srcObject: { getTracks: () => [track] } };
  return { controls, track, video };
}

test("a scan cancelled while decode is in flight stops the late controls and tracks", () => {
  let currentScanId = 0;
  const scanId = ++currentScanId;
  currentScanId += 1;
  const { controls, track, video } = fakeHardware();

  const settled = finishBarcodeScan({ scanId, currentScanId, controls, video });

  assert.equal(settled, null);
  assert.equal(controls.stopped, true);
  assert.equal(track.stopped, true);
  assert.equal(video.srcObject, null);
});

test("a scan that is still current keeps the camera running", () => {
  const scanId = 1;
  const { controls, track, video } = fakeHardware();

  const settled = finishBarcodeScan({ scanId, currentScanId: scanId, controls, video });

  assert.equal(settled, controls);
  assert.equal(controls.stopped, false);
  assert.equal(track.stopped, false);
  assert.equal(video.srcObject == null, false);
});

test("a throwing controls.stop still stops the media tracks", () => {
  const { track, video } = fakeHardware();
  const controls = {
    stop() {
      throw new Error("already stopped");
    },
  };

  releaseBarcodeHardware(controls, video);

  assert.equal(track.stopped, true);
  assert.equal(video.srcObject, null);
});

test("the food scanner uses the cancel guard", () => {
  const source = readFileSync(new URL("../components/NutritionTracker.vue", import.meta.url), "utf8");
  assert.match(source, /finishBarcodeScan\(/);
  assert.match(source, /releaseBarcodeHardware\(/);
  assert.match(source, /const scanId = \+\+barcodeScanId/);
});
