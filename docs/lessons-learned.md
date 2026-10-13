# Lessons learned

## Capacitor Android shell + background location (Oct 2026)

- `npx cap sync android` can silently leave stale web assets in `android/app/src/main/assets/public`.
  A "See the docs for adding the android platform" line in its output is the tell. Always verify
  the packaged APK afterwards: `unzip -p app-debug.apk assets/public/... | grep <marker>`.
- Reinstall (`adb install -r`) preserves app data **including the service worker cache**. A stale SW
  serves the old bundle and mimics impossible bugs (code proven absent still "running").
  `adb shell pm clear <pkg>` before retest builds.
- `LocalNotifications.schedule()` without `isExactNotification: false` holds the call forever on
  Android 12+: the OS parks it on the Alarms & reminders settings screen. Our alerts are
  tolerance-friendly, so always pass `isExactNotification: false`.
- The Web Notification API does not exist in the native shell. `notify()` must branch:
  service-worker/`Notification` on web, `LocalNotifications.schedule()` (fixed id, replaces like
  `tag`) on native. Same for permission: web `Notification.requestPermission()`, native
  `LocalNotifications.checkPermissions/requestPermissions`.
- WebView has no `navigator.permissions` (`.query` throws). `init()` already falls back to
  `'prompt'`; the Share-location tap path covers native entry.
- Capacitor 8 Android needs JDK 21 (its plugins request the Java 21 toolchain). JDK 17 fails the build.
- `@capacitor-community/background-geolocation` needs `android.useLegacyBridge: true` in
  `capacitor.config.ts`, else updates halt ~5 min after backgrounding.
- Background delivery on Android 10+ also wants `ACCESS_BACKGROUND_LOCATION` in the manifest
  ("Allow all the time"); it cannot be granted via `adb shell appops set`.
- Debug via Chrome DevTools Protocol: forward
  `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`, then `Runtime.evaluate`.
  Node 24 has a global WebSocket client, so inline `node -e` scripts work with no dependencies.
- `adb emu geo fix <lon> <lat>` teleports the emulator GPS; `dumpsys notification | grep pkg=`
  lists live records (titles are length-redacted, match by id/channel); `input keyevent KEYCODE_HOME`
  backgrounds the app; `cmd statusbar expand-notifications` opens the shade.

## Round 2: setup prompts, sound, release (Oct 2026)

- `npx cap sync` MUST run from the repo root (where `capacitor.config.ts` lives). From
  `android/` it prints a misleading docs link and copies nothing — then Gradle happily
  packages stale assets. After any sync doubt: `grep -a <marker> android/app/src/main/assets/...`.
- After failed Gradle builds, up-to-date checks can lie (`mergeDebugAssets UP-TO-DATE` with
  changed inputs). `rm -rf app/build` + rebuild when the APK timestamp doesn't move.
- PKCS12 keystores ignore a separate key password: keypass == storepass, always. The first
  keystore failed signing with "Given final block not properly padded" for exactly this reason.
- Minified chunks trip `grep` binary detection: always `grep -a` on `build/` and APK contents.
- Emulator UI driving: `adb shell input tap` silently misses taps on the bottom card, but CDP
  `Runtime.evaluate` clicks always land. Get the page id fresh per launch
  (`/json/list`, it changes with every process start).
- `LocalNotifications.schedule()` on Android 12+ also gates on the exact-alarm permission when
  the payload looks exact. Immediate alerts must pass `isExactNotification: false`.
- Custom notification sound: `res/raw/<name>.wav` + `sound` in capacitor config and per call.
  Android 8+ locks the channel sound at creation — reinstall/`pm clear` to hear changes.

## Map safe-area (Oct 2026)

- `viewport-fit=cover` puts web content under the status bar / cutout. App buttons already
  offset with `top-[max(0.75rem,env(safe-area-inset-top))]`, but Leaflet's `topleft` zoom
  control has only its own 10px margin. Override `.leaflet-top.leaflet-left` in `app.css`
  with the same `max(0.75rem, env(safe-area-inset-top))` top plus `env(safe-area-inset-left)`.
  Higher specificity (0,2,0) beats Leaflet's `.leaflet-top`, so no `!important` needed.

## Docs: single source for run commands (Oct 2026)

- `README.md` → `## Android app` owns Dev (`npx cap run`) vs Production (`bundleRelease`).
  `AGENTS.md` keeps only gotchas and points to it. Never duplicate command lists.
- Agent commit rules live in `AGENTS.md` → `## Commits, pushes, and version bumps`:
  `AGENT: ` prefix, short plain summaries, and bump/commit/push only on user instruction.

## App identity rename (Oct 2026)

- `applicationId` lives in 7 code spots: `capacitor.config.ts` `appId`,
  `app/build.gradle` `namespace` + `applicationId`, `strings.xml` `package_name` +
  `custom_url_scheme`, and the Java folder path + `package` lines (moved with `git mv`).
  `AndroidManifest.xml` needs no edit (uses `${applicationId}` and `.MainActivity`).
- After rename: `npx cap sync android` (keeps edits), `./gradlew assembleDebug`,
  then verify with `aapt dump badging app-debug.apk | grep ^package` (macOS `strings`
  cannot read the UTF-16 binary manifest; `grep -a` on it proves nothing).
- Docs mention the ID too: `docs/play-listing.md` title, `README.md` `pm clear` example.

## Capacitor iOS shell (Oct 2026)

- `npx cap add ios` needs `@capacitor/ios` installed first (`npm install @capacitor/ios@^8`).
  Bundle ID comes from `capacitor.config.ts` `appId` at add time — rename the ID before adding.
- All three plugins ship `Package.swift`, so `npx cap sync ios` uses SPM and never calls
  `pod`. A broken system CocoaPods does not matter.
- `cap add` does not write location keys. Add them to `ios/App/App/Info.plist` by hand
  (both `NSLocation*UsageDescription` strings + `UIBackgroundModes: location`).
- No `.xcworkspace` exists; build the `.xcodeproj` directly with `xcodebuild -scheme App`.
  Simulator name must match an installed device or destination lookup fails.
- `cap run ios --target` takes a simulator UDID (`simctl list devices`), not a name.
  Names work on Android only.
- Permission rows must refresh after the settings call settles, not only on
  `visibilitychange`: system permission prompts are overlay dialogs, the page never
  hides, so chain `.finally(() => refresh())` on both NativeSetup buttons.
- Native cold start must probe permission silently: `navigator.permissions.query` throws
  in WebViews, so `init()` branches on `isNative()` and uses `probeNativePermission()`
  (`addWatcher` with `requestPermissions: false` — granted delivers a fix, denied rejects
  on Android, iOS stays quiet until a 2.5 s timeout). Always `removeWatcher` afterwards.
- TestFlight silent alerts: check the silent switch, volume, and per-app Sounds setting
  before hunting code. A muted phone is the common cause.
- Sidebar version comes straight from `package.json` (`import { version }`), no extra
  dependency. The footer lives inside the panel's safe-area padding.
- Saved map pins are interactive with a `click` → `fitBounds` (same as sidebar Show on map).
  Capture `circle`/`pin` in consts: TS loses narrowing inside the closure otherwise.
- Beep interval is user-set (`notifyEverySec`, persisted, default 10): validate loaded values
  against the options list, and update every "every 10 seconds" sentence in docs when it changes.
- `InstallHint` must early-return on `isNative()`: `display-mode: standalone` never
  matches in a native WebView, and the iOS UA would otherwise fire the Home Screen toast.
- `NativeSetup` UI is Android-only: gate it behind `isAndroid()`. The plugin has no iOS
  implementation, so every check rejects and its rows can never clear on iOS.
- iOS `AppIcon.appiconset` needs a real 1024 universal icon (from `static/icons/icon-512.png`,
  full-bleed, not the maskable). `cap add` leaves Capacitor's stock icon in place.
- App Store rejects icons with an alpha channel (`file` must say RGB, not RGBA).
  Source the maskable (full-bleed), flatten onto theme teal `#0f2a26` at 1024 with ffmpeg
  (`overlay` + `format=rgb24`, `-frames:v 1` or muxing fails). No PIL or ImageMagick needed.
- Set `ITSAppUsesNonExemptEncryption=false` in `Info.plist` (app uses OS HTTPS only):
  each upload then skips the export-compliance questionnaire in Connect.
- Background beep on iOS comes from the notification sound, never the in-page `<audio>`
  (suspended in background). The wav must ship in the bundle root: copy to `ios/App/App/`
  and register file ref + Resources build phase in `project.pbxproj`. Verify with
  `find .../App.app -name <sound>.wav`. `notify()` gates `sound` on the Beep toggle.
- Native drawer padding: coarse-pointer media query zeroes `--panel-bottom`, and native
  shells are coarse pointers. Flag them with `html.native` (toggled in `+layout.svelte`)
  giving a `max(12px, safe-area)` floor; web PWA and desktop unchanged.
