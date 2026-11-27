/**
 * Run sign-out once. A second call while the first is still running does nothing.
 * After success the flag stays set (the page navigates away).
 * After failure the flag clears so the button can be used again.
 *
 * `signingOut` is a ref-like `{ value }` so the You page can bind `:disabled`.
 * Returns true when this call started the sign-out, false when it was ignored.
 */
export async function runGuardedSignOut(signingOut, action) {
  if (signingOut.value) return false;
  signingOut.value = true;
  try {
    await action();
    return true;
  } catch (error) {
    signingOut.value = false;
    throw error;
  }
}
