import { foodFromOpenFoodFacts } from "~/utils/openFoodFacts";
import { requirePrivateUserId } from "../../../utils/privateUserAccess";

export default defineEventHandler(async (event) => {
  await requirePrivateUserId(event);
  const code = String(getQuery(event).code || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) {
    throw createError({ statusCode: 400, statusMessage: "Enter the 8 to 14 digits under the barcode." });
  }
  let payload: unknown;
  try {
    payload = await $fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      headers: { "User-Agent": "FutureStar/1.0 (nutrition journal)" },
      timeout: 12000,
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "The product lookup did not answer. Try again." });
  }
  const food = foodFromOpenFoodFacts(payload as Parameters<typeof foodFromOpenFoodFacts>[0]);
  if (!food) {
    throw createError({ statusCode: 404, statusMessage: "No nutrition was found for that barcode. Enter the food by hand." });
  }
  return { food };
});
