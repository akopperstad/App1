import AVFoundation
import Capacitor
import UIKit

/// How Pulse's cues share the speaker with the user's music.
///
/// `.playback` so beeps are audible during a workout, with `.mixWithOthers`
/// (the default, "Play over music" in Settings) so they play *over*
/// Spotify / Apple Music instead of stopping it. The session is never
/// activated here: changing the category must not interrupt music by itself.
enum PulseAudioSession {
    static func configure(mixWithOthers: Bool) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: mixWithOthers ? [.mixWithOthers] : [])
        } catch {
            CAPLog.print("⚡️ PulseAudio: could not set audio session category: \(error)")
        }
    }
}

/// JS: `registerPlugin('PulseAudio').configure({ mixWithOthers })` (src/native/audioSession.ts).
@objc(PulseAudioPlugin)
public class PulseAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PulseAudioPlugin"
    public let jsName = "PulseAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise)
    ]

    @objc func configure(_ call: CAPPluginCall) {
        let mix = call.getBool("mixWithOthers") ?? true
        PulseAudioSession.configure(mixWithOthers: mix)
        call.resolve()
    }
}

/// Bridge view controller that registers the app's own (local) plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PulseAudioPlugin())
    }
}
