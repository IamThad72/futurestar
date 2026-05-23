/**
 * Sign out and return to the login page (replace history so Back does not reopen the app).
 */
export function useSignOut() {
  const auth = useAuthStore();
  const { go } = useAppNavigate();

  async function signOut() {
    await auth.logout();
    await go("/login", { replace: true });
  }

  return { signOut };
}
