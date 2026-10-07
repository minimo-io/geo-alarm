# AGENTS.md

Instructions for AI coding agents working on this repository.

## Project goal

This is the original brief for the project, verbatim. Treat it as the source of truth for scope and intent.

> Hey i need to create a pwa app (svekte -latest version, check the web + tailwind + daisyui). It will allow a simple thing, show a openstreet map add a pointer and a radius and (draw it on the map of for simplifity on mobile add the radio value. That will paint an area on the map and "set it". If the location of the user mobile phone gets inside that area it will send a notification each 10 seconds for the time the "geo alarm" is on, or for a configured set of seconds. For this to work the user must share location when the app starts else it won't work and we show insteaf of the map a "share location" message. This must be a pwa from the start so we must suggest the user, in a some cool nice way, like a closable tooltip to save it as a pwa (i think they will need chrome for this but i am not sure). That is the main purpose of this app. Create a mock project with this exact prompt in the AGENTS.md file and in the README.md file as the goal or description of this project.

## Follow-up requests

> ok now it would be great if we could have more than one point configured. When we want to see all points configured a sidebar panel opens at the right will all points (active and inactive; WE SHOULD MAKE AVAILABLE THE POSSILITY TO DISABLE THEM)

> Ok but you missunderstood how the "Stop after" should work. It is not for how long the thing should be active, it is to after the alarm is fired, for how long it should notify/or "beep"

> ok could we add an actual beep (user must be able to disable it from the sidebar also) .... but an actual sound

## Interpretation notes

- **Points** (`Zone` in `src/lib/alarm.svelte.ts`) have `id`, `name`, `lat`, `lng`, `radius`, `enabled`. They persist in `localStorage` (`geoalarm:zones:v1`).
- Placing a point is two steps: tap the map (draft, dashed) then **Add point**. The alarm is a single global on/off over all points with `enabled === true`.
- Disabled points stay visible (greyed, dashed) in the sidebar and on the map and are ignored by `activeZones` / `insideZones`. Never delete a point just because it is disabled.
- **Beep**: a real in-page sound played alongside each notification when `alarm.soundEnabled`. `src/lib/beep.ts` generates a WAV at runtime and plays it through an `<audio>` element (not Web Audio: iOS mutes Web Audio with the silent switch and often "interrupts" its context). It also sets `navigator.audioSession.type = 'playback'` where supported. The first `play()` must come from a tap, so `arm()`, the Beep toggle and the Test button all call `playBeep()` synchronously in the click handler; timers can replay it afterwards. `playBeep()` resolves `false` when blocked and the sidebar shows a hint. Toggle + Test live in `ZonesPanel.svelte`; the choice persists (`geoalarm:sound:v1`). The beep is independent of notification permission.
- One notification per 10 s tick, even if inside several points (it lists their names).
- The sidebar (`ZonesPanel.svelte`) opens from the right; it has a backdrop on phones only (`md:hidden`).

- "Set it" = a **Set alarm** button that arms the alarm using the current pointer and radius.
- "For the time the geo alarm is on, or for a configured set of seconds" = **Notify for** (`alarm.notifyForSec`): once the alarm *fires* (the phone enters a point), notify every 10 s for that many seconds, then stop notifying. `0` = keep notifying until the user leaves the point or turns the alarm off. This is **not** an auto-off timer: the alarm itself stays armed until the user turns it off.
- Fire / re-fire rule: the notification window opens per point when the phone goes from outside to inside. Leaving the point (or disabling/deleting it) resets it, so entering again fires again. Logic lives in `#tick()` in `src/lib/alarm.svelte.ts`.
- Notification interval is a constant: `NOTIFY_EVERY_MS = 10_000` in `src/lib/alarm.svelte.ts`.
- Without location permission the map must **not** render; show `ShareLocation.svelte` instead.
- The install hint must be closable, remember dismissal, and never show when already installed (`display-mode: standalone`).

## Stack and commands

Svelte 5 (runes) + SvelteKit 3 + Vite 8 + Tailwind CSS 4 + daisyUI 5 + Leaflet. Static, client-only PWA.

```sh
npm install
npm run dev
npm run check      # svelte-check, must pass with 0 errors
npm run build      # must succeed before you finish
```

## SvelteKit 3 gotchas (these differ from most online examples)

- **No `svelte.config.js`.** Pass config to `sveltekit({...})` in `vite.config.ts`, flat (no `kit:` namespace).
- **No `$lib` alias.** Use relative imports.
- **`$service-worker` is removed.** Use `immutable`, `assets`, `prerendered` from `$app/manifest` and `version` from `$app/env`.
- **`$app/environment` is now `$app/env`.**
- `tsconfig.json` extends `$app/tsconfig` and must exclude `src/service-worker.ts`.
- `@vite-pwa/sveltekit` is not compatible with Kit 3; the PWA is hand-written. Do not add it unless its peer range includes Kit 3.
- Keep TypeScript on 6.x until `svelte-check` supports 7.

## Conventions

- Svelte 5 runes only. No legacy `$:` or stores.
- Shared state lives in the `GeoAlarm` class in `src/lib/alarm.svelte.ts`. Components read it, they do not duplicate it.
- The map wrapper has `isolate` so Leaflet's internal z-indexes (up to 700) stay below overlays. Keep overlay z-indexes: buttons 400, control panel 500, backdrop 700, points panel 800, install card 1000.
- Styling: Tailwind utilities + daisyUI components. Theme tokens are defined in `src/app.css` (`geoalarm`); use `secondary` for the alarm zone. Avoid hard-coded colours.
- Respect `prefers-reduced-motion`. Keep tap targets large (mobile first).
- Copy: plain verbs, sentence case, say exactly what a button does.
- Leaflet is imported dynamically inside `onMount` (the app runs with `ssr = false`, but keep it safe).
- Keep OSM attribution visible. Do not bulk-prefetch tiles (OSM tile usage policy); the service worker only caches tiles the user has viewed (max 300).

## UI details learned the hard way

- Bottom panels use `var(--panel-bottom)` (defined in `src/app.css`), only about half of `env(safe-area-inset-bottom)`. The full inset left too much empty space in the installed iPhone app. Don't switch back to the raw inset.
- On dark surfaces (the install card is `bg-neutral`) don't use `btn-ghost`: its text colour is dark and the button disappears. Set `text-neutral-content` and a visible border explicitly.
- The install card must always be closable (✕, "Not now" and Escape) and must never show when running as an installed app (`standalone`, `fullscreen` or `minimal-ui`).

## Constraints to keep in mind

- Web apps cannot geolocate in the background. Do not promise it in UI copy. The wake lock only keeps the screen on while the alarm is armed.
- `Notification.requestPermission()` and `geolocation` prompts must be triggered from a user gesture.
- iOS delivers web notifications only to installed PWAs.
- Everything needs HTTPS in production.

## Done checklist

- [ ] `npm run check` passes
- [ ] `npm run build` passes
- [ ] Denying location shows the Share location screen, not the map
- [ ] Placing a pointer + moving the slider updates the circle live
- [ ] Add point saves it; reload keeps it
- [ ] Sidebar lists on and off points; the toggle greys the point out on the map
- [ ] A disabled point never notifies, even when armed and inside it
- [ ] Armed + inside any enabled point => notification immediately, then every 10 s
- [ ] Entering a point notifies at once, then every 10 s, and stops after "Notify for" while the alarm stays armed
- [ ] Leaving and re-entering the point fires again
- [ ] Beep plays with each notification; the sidebar toggle silences it and persists after reload
- [ ] Test button beeps (and only when the toggle is on)
- [ ] "Until I leave" keeps notifying until the phone is outside the point
- [ ] Install card appears, the ✕ and "Not now" are clearly visible and close it, and it does not reappear after dismissal
- [ ] In the installed app the install card never shows and the bottom panel has no big empty strip
