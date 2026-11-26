/**
 * decodeFromVideoDevice can resolve after the food modal has closed.
 * stopBarcodeScan runs first, before barcodeControls is assigned, so the
 * late controls object and its media tracks still have to be stopped.
 */
export function releaseBarcodeHardware(controls, video) {
  try {
    if (controls && typeof controls.stop === "function") controls.stop();
  } catch {
    /* the camera may already be stopped */
  }
  const stream = video?.srcObject;
  if (stream && typeof stream.getTracks === "function") {
    for (const track of stream.getTracks()) {
      if (typeof track.stop === "function") track.stop();
    }
  }
  if (video) video.srcObject = null;
}

/** Returns the controls to keep, or null when this scan was cancelled. */
export function finishBarcodeScan({ scanId, currentScanId, controls, video }) {
  if (scanId !== currentScanId) {
    releaseBarcodeHardware(controls, video);
    return null;
  }
  return controls ?? null;
}
