console.warn(
  "\n[cap:run:*:live] Skipping cap sync — the native app may still have an OLD web bundle.\n" +
    "  After UI/routing changes, run:  npm run cap:sync:dev   (or cap:sync for store builds)\n" +
    "  Then run again without :live, or sync manually before this command.\n",
);
