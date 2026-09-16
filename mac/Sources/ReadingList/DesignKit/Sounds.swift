@preconcurrency import AVFoundation
import Foundation

/// Subtle UI sounds, synthesised: no assets. The port of lib/sounds.ts, one
/// sine tap family, master gain 0.25. A sound marks a moment the eye can
/// miss or a beginning or an end; it never narrates navigation.
@MainActor
final class Sounds {
    static let shared = Sounds()

    var enabled = true

    private let engine = AVAudioEngine()
    private let sampleRate = 44_100.0
    private var players: [AVAudioPlayerNode] = []

    private struct Tone {
        var freq: Double
        var at: Double = 0
        var dur: Double = 0.15
        var peak: Double = 0.3
        var attack: Double = 0.005
        var glideTo: Double?
    }

    private func play(_ tones: [Tone]) {
        guard enabled, let buffer = render(tones) else { return }
        let player = AVAudioPlayerNode()
        engine.attach(player)
        // Touching the mixer wires it to the output; the graph must exist
        // before the engine starts.
        engine.connect(player, to: engine.mainMixerNode, format: buffer.format)
        if !engine.isRunning {
            engine.prepare()
            do {
                try engine.start()
            } catch {
                engine.detach(player)
                return
            }
        }
        players.append(player)
        player.scheduleBuffer(buffer, at: nil) { [weak self] in
            Task { @MainActor in self?.releaseFinished() }
        }
        player.play()
    }

    /// Detaches every player that has finished.
    private func releaseFinished() {
        for player in players where !player.isPlaying {
            engine.detach(player)
        }
        players.removeAll { !$0.isPlaying }
    }

    /// Every tap mixed into one buffer, so a phrase is one scheduled sound.
    private func render(_ tones: [Tone]) -> AVAudioPCMBuffer? {
        let end = tones.map { $0.at + $0.dur + 0.05 }.max() ?? 0
        let frames = AVAudioFrameCount(end * sampleRate)
        guard frames > 0,
            let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
            let samples = buffer.floatChannelData?[0]
        else { return nil }
        buffer.frameLength = frames
        for index in 0..<Int(frames) { samples[index] = 0 }
        for tone in tones {
            let start = Int(tone.at * sampleRate)
            let length = Int(tone.dur * sampleRate)
            var phase = 0.0
            for offset in 0..<length {
                let time = Double(offset) / sampleRate
                let progress = time / tone.dur
                let freq = tone.glideTo.map { tone.freq * pow($0 / tone.freq, progress) } ?? tone.freq
                phase += 2 * .pi * freq / sampleRate
                // Exponential attack to the peak, then an exponential decay.
                let envelope =
                    time < tone.attack
                    ? 0.0001 * pow(tone.peak / 0.0001, time / tone.attack)
                    : tone.peak * pow(0.0001 / tone.peak, (time - tone.attack) / max(tone.dur - tone.attack, 0.001))
                let index = start + offset
                if index < Int(frames) {
                    samples[index] += Float(sin(phase) * envelope * 0.25)
                }
            }
        }
        return buffer
    }

    // MARK: The set

    func itemCreated() {
        play([
            Tone(freq: 784, dur: 0.08, peak: 0.25), Tone(freq: 988, at: 0.06, dur: 0.08, peak: 0.25),
            Tone(freq: 1318, at: 0.12, dur: 0.18, peak: 0.25),
        ])
    }

    /// One tap whose pitch steps up with the grade (0 again … 3 easy).
    func cardRated(step: Int) {
        play([Tone(freq: 440 + Double(step) * 110, dur: 0.07, peak: 0.3)])
    }

    func cardSkipped() {
        play([Tone(freq: 330, dur: 0.09, peak: 0.18, glideTo: 247)])
    }

    func cardRevealed() {
        play([Tone(freq: 587, dur: 0.05, peak: 0.15)])
    }

    func itemStarred() {
        play([Tone(freq: 659, dur: 0.07, peak: 0.2), Tone(freq: 988, at: 0.07, dur: 0.09, peak: 0.2)])
    }

    func itemUnstarred() {
        play([Tone(freq: 988, dur: 0.07, peak: 0.2), Tone(freq: 659, at: 0.07, dur: 0.09, peak: 0.2)])
    }

    func itemDeleted() {
        play([Tone(freq: 110, dur: 0.18, peak: 0.3, attack: 0.003, glideTo: 70)])
    }

    func stackStarted() {
        play([
            Tone(freq: 523, dur: 0.07, peak: 0.18), Tone(freq: 659, at: 0.07, dur: 0.07, peak: 0.18),
            Tone(freq: 784, at: 0.14, dur: 0.12, peak: 0.18),
        ])
    }

    func error() {
        play([Tone(freq: 330, dur: 0.12, peak: 0.22), Tone(freq: 262, at: 0.09, dur: 0.16, peak: 0.22)])
    }

    func queueFinished() {
        play(
            [523.0, 659, 784, 1046].enumerated().map { index, freq in
                Tone(freq: freq * 1.002, at: Double(index) * 0.02, dur: 0.5, peak: 0.12, attack: 0.03)
            })
    }
}
