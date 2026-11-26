# App icon and splash sources

Sacred Ledger mark: navy `#1F3A5F` and gold `#C9A24A`. These are the tokens in `assets/css/main.css`. Do not recolor them here.

| File | Size | Use |
| --- | --- | --- |
| `icon-only.png` | 1024×1024 | iOS icon and Android legacy icon. Opaque RGB, square corners. |
| `icon-foreground.png` | 1024×1024 | Android adaptive foreground. Transparent background, star inside the central 66% safe zone. |
| `icon-background.png` | 1024×1024 | Solid navy adaptive background. |
| `splash.png` | 2732×2732 | Light splash on parchment `#FBF8F3`. |
| `splash-dark.png` | 2732×2732 | Dark splash on `#0F1621`, gold star, light wordmark. |

The star's bounding box is centered. "Future Star" sits below it with a gap of one star height, inside the 9:16 center crop that Android splash sizes use and inside the width a 360×800 phone keeps when the square splash is aspect-filled.

Regenerate native assets:

```bash
npm run cap:assets
```

That redraws these files and `public/icons/`, runs `@capacitor/assets` 3.0.5 for iOS and Android, then `scripts/normalize-native-icons.mjs`.

The color flags in `package.json` are double-quoted. Windows cmd passes single quotes through, which made the generator read the quote characters as part of the color.

`@capacitor/assets` 3.0.5 is limited to `--ios` and `--android`. Its PWA pass writes PNG bytes to repo-root `icons/*.webp`, points the manifest at those files, and fetches Apple's layout page for splash sizes. The web manifest and `public/icons/*.png` are written here instead.

The same version insets the adaptive background by 16.7% (a transparent rim) and writes the foreground at legacy launcher sizes. `normalize-native-icons.mjs` restores a full-bleed `#1F3A5F` color background, writes 108dp foreground PNGs, and keeps the legacy launcher opaque.

Do not bump `versionCode`, `MARKETING_VERSION`, or `CURRENT_PROJECT_VERSION` from this command.

Edit `utils/appIconArtwork.js` to change the mark. The colors stay on the tokens above.
