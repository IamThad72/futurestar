import { deleteAccountStaticHtml } from "~/utils/accountDeletionCopy.js";

function isDeleteAccountPath(path: string | undefined) {
  const bare = String(path ?? "").split("?")[0];
  return bare === "/delete-account" || bare === "/delete-account/";
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html, { event }) => {
    if (!isDeleteAccountPath(event.path)) return;
    html.bodyPrepend.push(deleteAccountStaticHtml());
  });

  nitroApp.hooks.hook("prerender:generate", (route) => {
    if (!isDeleteAccountPath(route.route) || !route.contents) return;
    if (route.contents.includes("delete-account-static")) return;
    route.contents = route.contents.replace("<body>", `<body>${deleteAccountStaticHtml()}`);
  });
});
