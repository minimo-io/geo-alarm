/**
 * Audible alarm made with the Web Audio API (no sound file needed, works offline).
 *
 * Browsers only allow audio after a user gesture, so unlockAudio() is called from taps
 * ("Start alarm", "Test sound"). After that, playBeep() can run from timers.
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): AudioContext | null {
	try {
		ctx ??= new AudioContext();
		if (ctx.state === 'suspended') void ctx.resume();
		return ctx;
	} catch {
		return null; // Web Audio not available
	}
}

/** Three quick rising beeps, loud enough to notice but not harsh. */
export function playBeep(): void {
	const c = unlockAudio();
	if (!c) return;

	const start = c.currentTime + 0.02;
	const notes = [880, 988, 1175]; // A5, B5, D6
	notes.forEach((freq, i) => {
		const t = start + i * 0.26;
		const osc = c.createOscillator();
		const gain = c.createGain();
		osc.type = 'square';
		osc.frequency.value = freq;

		// short fade in/out so it doesn't click
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
		gain.gain.setValueAtTime(0.25, t + 0.15);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);

		osc.connect(gain).connect(c.destination);
		osc.start(t);
		osc.stop(t + 0.2);
	});
}
