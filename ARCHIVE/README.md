# Archive

Non-production and unused project files moved here to keep the active app tree lean.

| Folder | Contents |
|--------|----------|
| `dev/pages/` | Test routes (`dev.vue`, `thad.vue`) and hidden pages (`register.vue`) — not shipped in store builds |
| `unused-components/` | Components no longer imported by the app |
| `unused-stores/` | Pinia scaffolding / theme experiments |
| `unused-composables/` | Unused composables |
| `unused-utils/` | Legacy DB helper superseded by server `pg` utils |
| `one-off-tools/` | HTTP scratch files, one-time migration scripts, Python import utilities |
| `sql-history/scripts/` | SQL scripts not in `run-migrations.mjs` (estate/auth/group schema history) |

**Active migrations** stay in `scripts/` — only files listed in `run-migrations.mjs`.
See `ARCHIVE/sql-history/MANIFEST.md` for the archived SQL list.

Restore a file by moving it back to its original path if you need it again.
