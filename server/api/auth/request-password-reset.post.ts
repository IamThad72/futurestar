import { createError, readBody } from "h3";
import { requestPasswordResetForEmail } from "../../utils/passwordReset";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email is required.",
    });
  }

  try {
    return await requestPasswordResetForEmail(event, email);
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("[auth/request-password-reset]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Could not send reset email. Try again later.",
    });
  }
});
