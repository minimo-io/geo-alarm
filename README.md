# Geo Alarm

## Goal

> Hey i need to create a pwa app (svekte -latest version, check the web + tailwind + daisyui). It will allow a simple thing, show a openstreet map add a pointer and a radius and (draw it on the map of for simplifity on mobile add the radio value. That will paint an area on the map and "set it". If the location of the user mobile phone gets inside that area it will send a notification each 10 seconds for the time the "geo alarm" is on, or for a configured set of seconds. For this to work the user must share location when the app starts else it won't work and we show insteaf of the map a "share location" message. This must be a pwa from the start so we must suggest the user, in a some cool nice way, like a closable tooltip to save it as a pwa (i think they will need chrome for this but i am not sure). That is the main purpose of this app. Create a mock project with this exact prompt in the AGENTS.md file and in the README.md file as the goal or description of this project.

## Follow-up requests

> ok now it would be great if we could have more than one point configured. When we want to see all points configured a sidebar panel opens at the right will all points (active and inactive; WE SHOULD MAKE AVAILABLE THE POSSILITY TO DISABLE THEM)

> Ok but you missunderstood how the "Stop after" should work. It is not for how long the thing should be active, it is to after the alarm is fired, for how long it should notify/or "beep"

> ok could we add an actual beep (user must be able to disable it from the sidebar also) .... but an actual sound

## What it does

1. On start, the app asks the user to share their location. Until they do, the map is replaced by a **Share location** screen.
2. The user taps the map to drop a pointer and picks a **radius** with a slider (works well on mobile). The area is painted on the map. **Add point** saves it.
3. Any number of points can be saved. They are stored on the device and survive a reload.
4. The **points panel** (☰ button, top right) slides in from the right and lists every point, on or off. Each one has a name, a radius slider, an **on/off toggle**, Show on map and Delete. Off points stay on the map, greyed out, and never trigger the alarm.
5. **Start alarm** arms every point that is on. The alarm stays armed until the user turns it off. Toggling a point off while armed takes effect immediately.
6. When the phone **enters** a point, the alarm fires: a notification right away, then **every 10 seconds** (naming the points) for the **Notify for** time (30 s, 1 min, 5 min, 15 min, or until the user leaves the area). After that it goes quiet for that point. Leaving and re-entering fires it again.
7. Each time it notifies, it also plays a **beep** (three rising tones generated at runtime and played through an audio element, no sound file). The points panel has a **Beep** toggle and a **Test** button. The choice is remembered. Beeps only sound while the app is open, which is also when the 10 second loop runs.
8. A closable hint invites the user to install the app as a PWA.

## Stack (checked October 2026)

| Piece | Version | Notes |
| --- | --- | --- |
| Svelte | 5.57 | Runes (`$state`, `$derived`, `$effect`) |
| SvelteKit | 3.0 | Config lives in `vite.config.ts`; no `svelte.config.js` |
| Vite | 8 | |
| Tailwind CSS | 4.3 | Via `@tailwindcss/vite`, CSS-first config in `src/app.css` |
| daisyUI | 5.7 | `@plugin "daisyui"` with a custom `geoalarm` theme |
| Leaflet | 1.9 | OpenStreetMap tiles |
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

```sh
npm run build              # static site in ./build (the shell serves this)
npx cap sync android       # must run from the repo root, never from android/
# inside android/:
./gradlew assembleDebug    # debug APK for testing
./gradlew bundleRelease    # signed Play bundle (needs the key below)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Test background alerts: arm the alarm, press HOME, teleport the emulator GPS
(`adb emu geo fix <lon> <lat>`). Far away stays quiet; back inside fires within seconds.

**The signing keys, plainly:** two files, `android/geoalarm-release.keystore` and
`android/keystore.properties`. Both are gitignored and never pushed. Debug and local testing
never use them. They matter only at the first Play Store upload — from then on, losing them
means never updating the app again. Back up the password in a password manager; regenerating
is safe any time before that first upload.

**Moving machines:** hand-copy those two key files (or regenerate pre-Play), reinstall the
toolchain plus `npm install`; everything else regenerates (emulator images, `build/`, Gradle
caches, `node_modules`).

## Known limitations of a web app

- Browsers **cannot track location in the background**. The 10 second notifications only run while the app is open and the screen is on. While the alarm is armed the app requests a **screen wake lock** to keep going.
- Truly background geofencing needs a native app — that is the Android shell above.
- Notification sounds/vibration vary by OS and browser settings.
- **iPhone sound:** the in-app beep needs the volume up. It is built to play even with the ring/silent switch on (iOS 16.4+), but if you hear nothing, use the **Test** button in the points panel; it tells you when the browser blocks the sound. Audio can't play while the screen is locked or the app is in the background.

## Project layout

```
src/
  app.css                      Tailwind + daisyUI theme
  service-worker.ts            App shell cache, OSM tile cache, notification click
  lib/
    alarm.svelte.ts            All state: permission, position, zone, alarm timer
    geo.ts                     Haversine distance, formatting
    notify.ts                  Notification permission + showNotification (web) or local-notifications (native shell)
    beep.ts                    Generated WAV beep played via <audio> (needs a tap first)
    location-provider.ts       Position source: web watchPosition or native background watcher
    native-setup.ts            Native shell permissions (background location, battery exemption)
    components/
      NativeSetup.svelte       Native shell permission prompts (Android only)
      AlarmMap.svelte          Leaflet map, saved points, draft point, user dot
      ControlPanel.svelte      New point radius, "Notify for", Add point / Start / Turn off
      ZonesPanel.svelte        Right sidebar: all points, on/off toggle, rename, radius, delete
      ShareLocation.svelte     Shown instead of the map without location access
      InstallHint.svelte       Closable PWA install card
  routes/                      +layout.ts (ssr off), +layout.svelte, +page.svelte
static/                        manifest.webmanifest, icons
android/                       Capacitor shell (committed: manifest, sound, icons, platform code)
capacitor.config.ts            Shell config: webDir build, legacy bridge, notification sound
```
