import { getSessionUserOrNull } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await getSessionUserOrNull(event);
  return { user: user ?? null };
});
