import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseFetchError } from "../utils/parseFetchError.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const MESSAGE = "Couldn't save the file. Please try again.";

test("estate upload errors stay friendly instead of a raw API error", () => {
  const panel = read("components/EstateDocumentsPanel.vue");
  const server = read("server/utils/estateDocuments.ts");
  const example = read(".env.example");
  const readme = read("README.md");

  assert.match(server, /export const ESTATE_FILE_SAVE_MESSAGE = "Couldn't save the file\. Please try again\."/);
  assert.match(panel, /uploadError\.value = parseFetchError\(error, "Couldn't save the file\. Please try again\."\)/);
  assert.doesNotMatch(panel, /uploadError\.value = error/);
  assert.doesNotMatch(server, /ESTATE_DOCS_STORAGE/);
  assert.doesNotMatch(server, /writeFile/);
  assert.match(example, /ESTATE_DOCS_DIR/);
  assert.match(example, /no disk fallback/);
  assert.doesNotMatch(example, /ESTATE_DOCS_STORAGE=disk/);
  assert.match(readme, /Couldn't save the file\. Please try again\./);
  assert.match(readme, /ESTATE_DOCS_STORAGE` is not used/);

  const ofetch = {
    name: "FetchError",
    message: `[POST] "https://app.example.com/api/estate-mgmt/documents": 503 Service Unavailable`,
    statusCode: 503,
    status: 503,
    statusMessage: "Service Unavailable",
    data: {
      error: true,
      url: "https://app.example.com/api/estate-mgmt/documents",
      statusCode: 503,
      statusMessage: "Service Unavailable",
      message: MESSAGE,
      data: { message: MESSAGE },
    },
  };
  assert.equal(parseFetchError(ofetch, "Failed to upload document."), MESSAGE);
  assert.doesNotMatch(parseFetchError(ofetch, "Failed to upload document."), /\[POST\]|Service Unavailable|https:\/\//);

  assert.equal(parseFetchError({
    name: "FetchError",
    message: `[POST] "/api/estate-mgmt/documents": 502 ${MESSAGE}`,
    statusCode: 502,
    statusMessage: "Bad Gateway",
    data: { statusCode: 502, statusMessage: "Bad Gateway", message: "Bad Gateway" },
  }, "Failed to upload document."), MESSAGE);

  assert.equal(parseFetchError({
    statusCode: 503,
    statusMessage: "Service Unavailable",
    message: `[POST] "/api/estate-mgmt/documents": 503 Service Unavailable`,
    data: { statusCode: 503, statusMessage: "Service Unavailable", message: "Service Unavailable" },
  }, MESSAGE), MESSAGE);

  assert.equal(
    parseFetchError({
      statusCode: 400,
      data: { statusMessage: "That file type is not allowed. Use PDF, images, Word, Excel, PowerPoint, or text." },
    }, MESSAGE),
    "That file type is not allowed. Use PDF, images, Word, Excel, PowerPoint, or text.",
  );

  assert.equal(parseFetchError({
    statusCode: 500,
    data: { statusMessage: "Failed to load documents." },
    message: `[GET] "/api/estate-mgmt/documents": 500 Failed to load documents.`,
  }, "Failed to load documents."), "Failed to load documents.");
});
