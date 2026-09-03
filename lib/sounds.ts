// Subtle UI sounds, synthesised with Web Audio: no assets, no dependencies.
// Three moments get a tone — an item landing in the list, a card being
// rated, a queue finishing. Every trigger sits inside a user gesture, so the
// context is created lazily on first play and autoplay policy never blocks.
import { type Rating } from "@/lib/srs";

const MASTER_GAIN = 0.25;

let audioContext: AudioContext | null = null;
let master: GainNode | null = null;

const getMaster = (): GainNode | null => {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    audioContext = new AudioContext();
    master = audioContext.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") void audioContext.resume();
  return master;
};

// One sine tap: a quick exponential attack to `peak`, then an exponential
// decay to silence at `dur`, starting `at` seconds from now. `glideTo`
// slides the pitch there over the tap's length.
const tone = ({
  freq,
  at = 0,
  dur = 0.15,
  peak = 0.3,
  attack = 0.005,
  glideTo,
}: {
  freq: number;
  at?: number;
  dur?: number;
  peak?: number;
  attack?: number;
  glideTo?: number;
}) => {
  const destination = getMaster();
  if (!destination || !audioContext) return;
  const start = audioContext.currentTime + at;
  const oscillator = audioContext.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(freq, start);
  if (glideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  }
  const envelope = audioContext.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + dur + 0.05);
};

// A new item landed: an ascending arpeggio.
export const playItemCreated = () => {
  tone({ freq: 784, dur: 0.08, peak: 0.25 });
  tone({ freq: 988, at: 0.06, dur: 0.08, peak: 0.25 });
  tone({ freq: 1318, at: 0.12, dur: 0.18, peak: 0.25 });
};

const RATING_STEP: Record<Rating, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
};

// A card rated: one tap whose pitch steps up with the grade.
export const playCardRated = (rating: Rating) => {
  tone({ freq: 440 + RATING_STEP[rating] * 110, dur: 0.07, peak: 0.3 });
};

// A card set aside: one low tap that slides down, quieter than a rating
// so it reads as "later", not as a grade.
export const playCardSkipped = () => {
  tone({ freq: 330, glideTo: 247, dur: 0.09, peak: 0.18 });
};

// The answer shows: the smallest tick in the set, below the rating taps so
// the sequence reads reveal, then grade.
export const playCardRevealed = () => {
  tone({ freq: 587, dur: 0.05, peak: 0.15 });
};

// Starred: two notes up; unstarred: the same two, down.
export const playItemStarred = () => {
  tone({ freq: 659, dur: 0.07, peak: 0.2 });
  tone({ freq: 988, at: 0.07, dur: 0.09, peak: 0.2 });
};

export const playItemUnstarred = () => {
  tone({ freq: 988, dur: 0.07, peak: 0.2 });
  tone({ freq: 659, at: 0.07, dur: 0.09, peak: 0.2 });
};

// Deleted: a low thud, the one weighty sound in the set, because this is the
// one thing the app can't undo.
export const playItemDeleted = () => {
  tone({ freq: 110, glideTo: 70, dur: 0.18, peak: 0.3, attack: 0.003 });
};

// A stack starts: a rising phrase, lighter than the paste arpeggio, the
// opening bracket to the finish chord.
export const playStackStarted = () => {
  tone({ freq: 523, dur: 0.07, peak: 0.18 });
  tone({ freq: 659, at: 0.07, dur: 0.07, peak: 0.18 });
  tone({ freq: 784, at: 0.14, dur: 0.12, peak: 0.18 });
};

// Something failed: two low notes, down. Quiet; the toast carries the words.
export const playError = () => {
  tone({ freq: 330, dur: 0.12, peak: 0.22 });
  tone({ freq: 262, at: 0.09, dur: 0.16, peak: 0.22 });
};

// The queue is done: a soft, slightly detuned major chord.
export const playQueueFinished = () => {
  [523, 659, 784, 1046].forEach((freq, index) => {
    tone({
      freq: freq * 1.002,
      at: index * 0.02,
      dur: 0.5,
      peak: 0.12,
      attack: 0.03,
    });
  });
};
