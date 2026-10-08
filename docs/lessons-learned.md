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
