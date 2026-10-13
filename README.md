# Geo Alarm

## Goal

Geo Alarm is a GPS location alarm: draw areas on a map and get notified, with a beep,
when you enter them. It ships as an installable web app (PWA) plus native Android
and iOS shells that keep alerting with the app closed. Everything runs on-device:
no account, no server.

<details>
<summary>Original brief (verbatim)</summary>

> Hey i need to create a pwa app (svekte -latest version, check the web + tailwind + daisyui). It will allow a simple thing, show a openstreet map add a pointer and a radius and (draw it on the map of for simplifity on mobile add the radio value. That will paint an area on the map and "set it". If the location of the user mobile phone gets inside that area it will send a notification each 10 seconds for the time the "geo alarm" is on, or for a configured set of seconds. For this to work the user must share location when the app starts else it won't work and we show insteaf of the map a "share location" message. This must be a pwa from the start so we must suggest the user, in a some cool nice way, like a closable tooltip to save it as a pwa (i think they will need chrome for this but i am not sure). That is the main purpose of this app. Create a mock project with this exact prompt in the AGENTS.md file and in the README.md file as the goal or description of this project.

</details>

## Follow-up requests

> ok now it would be great if we could have more than one point configured. When we want to see all points configured a sidebar panel opens at the right will all points (active and inactive; WE SHOULD MAKE AVAILABLE THE POSSILITY TO DISABLE THEM)

> Ok but you missunderstood how the "Stop after" should work. It is not for how long the thing should be active, it is to after the alarm is fired, for how long it should notify/or "beep"

> ok could we add an actual beep (user must be able to disable it from the sidebar also) .... but an actual sound

## What it does

1. On start, the app needs your location. On the web, a **Share location** screen covers the map until you accept. In the native shells the app checks silently: if you already allowed it, the map opens straight away.
2. The user taps the map to drop a pointer and picks a **radius** with a slider (works well on mobile). The area is painted on the map. **Add point** saves it.
3. Any number of points can be saved. They are stored on the device and survive a reload.
4. The **points panel** (☰ button, top right) slides in from the right and lists every point, on or off. Each one has a name, a radius slider, an **on/off toggle**, Show on map and Delete. Off points stay on the map, greyed out, and never trigger the alarm. The panel footer shows the app version.
5. **Start alarm** arms every point that is on. The alarm stays armed until the user turns it off. Toggling a point off while armed takes effect immediately.
6. When the phone **enters** a point, the alarm fires: a notification right away, then repeatedly (naming the points) for the **Notify for** time (30 s, 1 min, 5 min, 15 min, or until the user leaves the area). The repeat interval is set in the points panel (**Beep every**, default 10 s) and remembered. After that it goes quiet for that point. Leaving and re-entering fires it again.
7. Each notification also plays a **beep**. In the app it plays through an audio element (needs a tap first, foreground only); in the native shells the bundled beep sound also plays with the notification while backgrounded. The points panel has a **Beep** toggle and a **Test** button that silence both. The choice is remembered.
8. On the web, a closable hint invites the user to install the app as a PWA. Native shells never show it — they are already apps.

## Stack (checked October 2026)

| Piece | Version | Notes |
| --- | --- | --- |
| Svelte | 5.57 | Runes (`$state`, `$derived`, `$effect`) |
| SvelteKit | 3.0 | Config lives in `vite.config.ts`; no `svelte.config.js` |
| Vite | 8 | |
| Tailwind CSS | 4.3 | Via `@tailwindcss/vite`, CSS-first config in `src/app.css` |
| daisyUI | 5.7 | `@plugin "daisyui"` with a custom `geoalarm` theme |
| Leaflet | 1.9 | OpenStreetMap tiles |
| Capacitor | 8 | Native Android + iOS shells around the same build (SPM plugins on iOS) |
| Background location | 1.2 | `@capacitor-community/background-geolocation` watcher in native shells |
| TypeScript | 6 | `svelte-check` does not support TS 7 yet |

PWA is hand-rolled (`static/manifest.webmanifest` + `src/service-worker.ts`) because `@vite-pwa/sveltekit` does not support SvelteKit 3 yet.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173 (geolocation works on localhost)
npm run build      # static site in ./build
npm run preview
```

Geolocation, notifications and service workers require **HTTPS** (or `localhost`). To test on a phone, deploy `./build` to any static host with HTTPS, or tunnel the dev server.

## Installing as a PWA

- **Android (Chrome, Edge, Samsung Internet):** the browser fires `beforeinstallprompt`; the app shows a closable card with an **Install app** button.
- **iPhone / iPad (Safari):** there is no install prompt. The card explains **Share → Add to Home Screen**. iOS only delivers web notifications to installed apps (iOS 16.4+).
- **Desktop Chrome / Edge:** install icon in the address bar, plus the in-app card.

So Chrome is not strictly required, but it gives the smoothest one-tap install.

## Android app (Capacitor)

The same static build wrapped in a native Android shell, for alerts that keep working with
the app closed. The web PWA is untouched and always works without any of this.

You need three things, however they are installed on your machine: **JDK 21** (`java -version`
shows 21 — Capacitor 8 refuses anything else), the **Android SDK** with platform-tools plus one
platform plus build-tools (`sdkmanager --version`, `adb devices`), and an **emulator image matching
your CPU** (arm64 on Apple Silicon, x86_64 on Intel/AMD). Two env vars point at the first two;
their values differ per machine. Install from official sources (Android Studio or Google's
cmdline tools plus a Temurin/Adoptium JDK).

### Dev: run on local emulator

```sh
npx cap run android --list   # show emulator targets
adb shell pm clear lat.cubiq.geoalarm  # clear cache, else old code shows
npm run build                # static site in ./build (the shell serves this)
npx cap run android --target Pixel_9   # syncs, builds debug, installs, starts
```

`run` already syncs and calls Gradle. No separate `sync` or `assembleDebug` in dev.
Each new shell needs JDK 21 first: `export JAVA_HOME` to your JDK 21
(Android Studio bundle works). `java -version` must show 21.

Test background alerts: arm the alarm, press HOME, teleport the emulator GPS
(`adb emu geo fix <lon> <lat>`). Far away stays quiet; back inside fires within seconds.

### Production: release bundle

```sh
# inside android/, JDK 21 env:
./gradlew assembleRelease bundleRelease    # signed Play bundle (needs the key below)
```

**The signing keys, plainly:** two files, `android/geoalarm-release.keystore` and
`android/keystore.properties`. Both are gitignored and never pushed. Debug and local testing
never use them. They matter only at the first Play Store upload — from then on, losing them
means never updating the app again. Back up the password in a password manager; regenerating
is safe any time before that first upload.

**Moving machines:** hand-copy those two key files (or regenerate pre-Play), reinstall the
toolchain plus `npm install`; everything else regenerates (emulator images, `build/`, Gradle
caches, `node_modules`).

## iOS app (Capacitor)

The same static build wrapped in a native iOS shell. Needs macOS with Xcode.
The Simulator needs no paid account or signing.

```sh
xcrun simctl list devices available   # names + UDIDs
xcrun simctl uninstall booted lat.cubiq.geoalarm  # clear cache, else old code shows
npm run build
npx cap run ios --target <UDID>       # UDID only, names fail
```

`run` already syncs. No separate `sync` in dev (only for manual `xcodebuild` flows).

Location keys and the background mode live in `ios/App/App/Info.plist`
(`NSLocationWhenInUseUsageDescription`,
`NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: location`).
Plugins resolve through Swift Package Manager — no CocoaPods needed.
Simulate movement in the Simulator via Features → Location → Custom Location.
The Simulator proves UI and foreground alerts, not real background GPS.
Beta builds go out through TestFlight internal testing.

## Known limitations of a web app

- Browsers **cannot track location in the background**. The 10 second notifications only run while the app is open and the screen is on. While the alarm is armed the app requests a **screen wake lock** to keep going.
- Truly background geofencing needs a native app — that is the Android and iOS shells above.
- Notification sounds/vibration vary by OS and browser settings.
- **iPhone sound:** the in-app beep needs the volume up and the app open. The native notification beep plays backgrounded but obeys the ring/silent switch and the per-app Sounds setting — a muted phone gets silent alerts. If you hear nothing, use the **Test** button in the points panel; it tells you when the browser blocks the sound. Audio can't play while the screen is locked or the app is in the background.

## Project layout

```
src/
  app.css                      Tailwind + daisyUI theme
  service-worker.ts            App shell cache, OSM tile cache, notification click
  lib/
    alarm.svelte.ts            All state: permission, position, zone, alarm timer
    geo.ts                     Haversine distance, formatting
    notify.ts                  Notification permission + showNotification (web) or local-notifications (native shell, beep gated by toggle)
    beep.ts                    Generated WAV beep played via <audio> (needs a tap first, foreground only)
    location-provider.ts       Position source: web watchPosition, native background watcher, silent permission probe, platform helpers
    native-setup.ts            Native shell permissions (background location, battery exemption)
    components/
      NativeSetup.svelte       Android-only permission prompts (hidden on iOS)
      AlarmMap.svelte          Leaflet map, saved points, draft point, user dot
      ControlPanel.svelte      New point radius, "Notify for", Add point / Start / Turn off
      ZonesPanel.svelte        Right sidebar: all points, on/off toggle, rename, radius, delete, version footer
      ShareLocation.svelte     Shown instead of the map without location access
      InstallHint.svelte       Closable PWA install card (never in native shells)
  routes/                      +layout.ts (ssr off), +layout.svelte, +page.svelte
static/                        manifest.webmanifest, icons
LICENSE                        MIT (cubiq.lat)
android/                       Capacitor shell (committed: manifest, sound, icons, platform code)
ios/                           Capacitor shell (committed: plist, sound, icons, platform code)
capacitor.config.ts            Shell config: appId lat.cubiq.geoalarm, webDir build, legacy bridge, notification sound
```
