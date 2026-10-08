# Play Store release pack — Geo Alarm (`io.minimo.geoalarm`)

## Build

```sh
# Debug (internal testing, emulator)
./gradlew assembleDebug

# Release (Play upload needs the AAB, same key every time)
./gradlew assembleRelease bundleRelease
# outputs: android/app/build/outputs/apk/release/app-release.apk
#          android/app/build/outputs/bundle/release/app-release.aab
```

Signing reads `android/keystore.properties` (gitignored, never commit). Keystore:
`android/geoalarm-release.keystore`, alias `geoalarm`. Passwords live only in that file
and were printed once at creation — lose the key and updates to this listing become
impossible. `versionCode 1`, `versionName "1.0"` in `android/app/build.gradle`.

## Permissions declared (why each exists)

| Permission | Why |
|---|---|
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Core function: detect entry into alarm areas. |
| `ACCESS_BACKGROUND_LOCATION` | Core function: keep detecting entry while the alarm is armed and the app is backgrounded. Requested via app-settings upgrade flow, never silently. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | Keep the location watcher alive in background with a persistent "Geo Alarm is on" notification. |
| `POST_NOTIFICATIONS` | Deliver the entry alert. |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Ask the user (Xiaomi/Samsung etc.) to exempt the app so the alarm survives. Optional, user-confirmed. |
| `INTERNET` | Load OpenStreetMap tiles. No account, no backend, no analytics. |

## Data safety (form answers)

- Location collected: yes — precise location, foreground + background.
- Purpose: app functionality (the alarm cannot work without it).
- Sharing: none. No server, no SDK, no analytics. Everything stays on device.
- Deletion: nothing leaves the device; uninstall removes points (localStorage).

## Background location justification (review text)

> Geo Alarm is a location alarm: the user draws areas on a map and gets an alert on
> entering them. The alarm is explicitly armed by the user and runs a persistent
> notification ("Geo Alarm is on") while active. Entry detection must continue when
> the phone is in a pocket with the screen off — that is the entire product. Location
> never leaves the device; there is no server component.

## Pre-submit checklist

- [ ] Release AAB built with the release key, `versionCode` bumped for updates
- [ ] Feature graphic + screenshots (phone, alarm armed + notification)
- [ ] Privacy policy URL (required: state on-device-only location, no collection)
- [ ] App content: background-location permission declaration approved
- [ ] Data safety form matches the table above
- [ ] Internal testing track pass on 2+ real devices (GPS, background kill, reboot)
