/**
 * Audible alarm: a short beep pattern generated at runtime as a WAV file and played
 * through a normal <audio> element (no sound asset to ship, works offline).
 *
 * Why <audio> and not Web Audio: on iPhone, Web Audio is muted by the ring/silent switch
 * and its context is easily "interrupted" (notifications, screen lock). Media elements are
 * not muted by the silent switch, and once one has been played from a tap it can be
 * replayed from timers.
 *
 * Browsers only allow the first play() after a user gesture, so playBeep() must first be
 * called from a tap ("Start alarm", the Beep toggle, "Test"). After that, timers can use it.
 */
let audio: HTMLAudioElement | null = null;

function makeBeepWav(): string {
	const rate = 22050;
	const notes = [880, 988, 1175]; // A5, B5, D6
	const tone = 0.19;
	const gap = 0.07;
	const n = Math.floor(notes.length * (tone + gap) * rate);
	const pcm = new Int16Array(n);

	notes.forEach((freq, i) => {
		const start = Math.floor(i * (tone + gap) * rate);
		const len = Math.floor(tone * rate);
		for (let j = 0; j < len; j++) {
			const s = Math.sin((2 * Math.PI * freq * j) / rate);
			const wave = 0.6 * Math.sign(s) + 0.4 * s; // square-ish: cuts through noise
			const env = Math.min(1, j / (0.015 * rate), (len - j) / (0.03 * rate)); // no clicks
			pcm[start + j] = Math.round(wave * env * 0.7 * 32767);
		}
	});

	const buf = new ArrayBuffer(44 + n * 2);
	const v = new DataView(buf);
	const str = (o: number, t: string) => [...t].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
	str(0, 'RIFF');
	v.setUint32(4, 36 + n * 2, true);
	str(8, 'WAVE');
	str(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); // PCM
	v.setUint16(22, 1, true); // mono
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	str(36, 'data');
	v.setUint32(40, n * 2, true);
	new Int16Array(buf, 44).set(pcm);

	return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function getAudio(): HTMLAudioElement {
	if (!audio) {
		// iOS 16.4+: "playback" makes sound play even with the silent switch on.
		try {
			const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
			if (session) session.type = 'playback';
		} catch {
			/* not supported */
		}
		audio = new Audio(makeBeepWav());
		audio.preload = 'auto';
		audio.setAttribute('playsinline', '');
	}
	return audio;
}

/** Plays the beep. Resolves false if the browser blocked it (no tap yet, or muted by the system). */
export async function playBeep(): Promise<boolean> {
	try {
		const a = getAudio();
		a.currentTime = 0;
		await a.play();
		return true;
	} catch {
		return false;
	}
}
