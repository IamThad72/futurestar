/**
 * Sign out and stay in the app. Login remains a header link.
 */
export function useSignOut() {
  const auth = useAuthStore();
  const { go } = useAppNavigate();

  async function signOut() {
    await auth.logout();
    await go("/today", { replace: true });
  }

  return { signOut };
}
