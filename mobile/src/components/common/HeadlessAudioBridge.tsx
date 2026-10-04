import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { audioVoiceEngine } from '../../services/AudioVoiceEngine';

const AUDIO_BRIDGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <script>
    let currentAudio = null;
    let audioContext = null;
    let micStream = null;
    let micAnalyser = null;
    let recognition = null;
    let animId = null;

    let isCurrentlyListening = false;
    let silenceTimer = null;
    let currentTranscriptBuffer = '';

    // Real-time frequency calculation loop
    function startFrequencyLoop(analyser) {
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      function step() {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 2; i < Math.min(buffer.length, 64); i++) {
          sum += buffer[i];
        }
        const avg = sum / 62;
        const normalized = Math.max(0, Math.min(1.0, avg / 110));
        
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FREQUENCY',
            value: normalized
          }));
        }
        animId = requestAnimationFrame(step);
      }
      animId = requestAnimationFrame(step);
    }

    function stopFrequencyLoop() {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }

    // Play MP3 audio from Google Translate TTS or any audio data URI
    window.playAudio = function(uri) {
      try {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }

        currentAudio = new Audio(uri);

        currentAudio.onplay = function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START' }));
          }
        };

        currentAudio.onended = function() {
          currentAudio = null;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FINISH' }));
          }
        };

        currentAudio.onerror = function(e) {
          currentAudio = null;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: 'Audio playback failed' }));
          }
        };

        currentAudio.play().catch(function(err) {
          currentAudio = null;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: err.message || 'Play rejected' }));
          }
        });
      } catch (err) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: err.message || 'Audio init error' }));
        }
      }
    };

    // Native device speech synthesis (fallback when Google TTS is unavailable)
    window.speakNative = function(text, lang) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = (lang === 'hi' || lang === 'hinglish') ? 'hi-IN' : 'en-IN';
        utter.rate = 1.0;

        utter.onstart = function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START' }));
          }
        };

        utter.onend = function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FINISH' }));
          }
        };

        utter.onerror = function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FINISH' }));
          }
        };

        window.speechSynthesis.speak(utter);
      } catch (_) {}
    };

    window.stopAudio = function() {
      try {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio = null;
        }
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STOP' }));
        }
      } catch (_) {}
    };

    let mediaRecorder = null;
    let audioChunks = [];

    // Real microphone input & real frequency analysis
    window.startListening = function(langCode) {
      try {
        isCurrentlyListening = true;
        currentTranscriptBuffer = '';
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
        audioChunks = [];
        // Request actual microphone hardware stream
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
          micStream = stream;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MIC_CONNECTED' }));
          }

          // 1. Hardware frequency analyser
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            audioContext = new AudioContextClass();
            const source = audioContext.createMediaStreamSource(stream);
            micAnalyser = audioContext.createAnalyser();
            micAnalyser.fftSize = 256;
            micAnalyser.smoothingTimeConstant = 0.5;
            source.connect(micAnalyser);
            startFrequencyLoop(micAnalyser);
          }
        }).catch(function(err) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: 'Microphone permission denied: ' + (err.message || err.name)
            }));
          }
        });

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRec) {
          if (recognition) {
            try { recognition.abort(); } catch(_) {}
          }
          recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = (langCode === 'hi' || langCode === 'hinglish') ? 'hi-IN' : 'en-IN';

          recognition.onresult = function(event) {
            let interim = '';
            let final = '';
            for (let i = 0; i < event.results.length; ++i) {
              if (event.results[i].isFinal) final += event.results[i][0].transcript;
              else interim += event.results[i][0].transcript;
            }
            const currentText = (final + ' ' + interim).trim();
            currentTranscriptBuffer = currentText;

            // Stream real-time captions to mobile
            if (window.ReactNativeWebView && currentText) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TRANSCRIPT',
                text: currentText,
                isFinal: false
              }));
            }

            // Continuous silence detection (send text when user stops speaking for ~850ms)
            if (silenceTimer) clearTimeout(silenceTimer);
            if (currentText.length > 0) {
              silenceTimer = setTimeout(function() {
                if (window.ReactNativeWebView && isCurrentlyListening && currentTranscriptBuffer) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'TRANSCRIPT',
                    text: currentTranscriptBuffer,
                    isFinal: true
                  }));
                  currentTranscriptBuffer = '';
                }
              }, 850);
            }
          };

          recognition.onerror = function(e) {
            if (e.error === 'no-speech') return;
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.error }));
            }
          };

          recognition.onend = function() {
            // In continuous mode, restart recognition automatically if still active
            if (isCurrentlyListening) {
              try {
                recognition.start();
              } catch (_) {}
            } else {
              stopFrequencyLoop();
            }
          };

          recognition.start();
        }
      } catch (err) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: err.message }));
        }
      }
    };

    window.stopListening = function() {
      isCurrentlyListening = false;
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      currentTranscriptBuffer = '';
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
      stopFrequencyLoop();

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.onstop = function() {
            try {
              const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
              const reader = new FileReader();
              reader.onloadend = function() {
                if (window.ReactNativeWebView && reader.result) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'AUDIO_RECORDED',
                    audioDataUri: reader.result
                  }));
                }
              };
              reader.readAsDataURL(blob);
            } catch (_) {}
          };
          mediaRecorder.stop();
        } catch (_) {}
      }

      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
        recognition = null;
      }
    };
  </script>
</body>
</html>
`;

export const HeadlessAudioBridge: React.FC = () => {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      audioVoiceEngine.setNativeBridge({
        play: (uri: string) => {
          const safeUri = uri.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          webViewRef.current?.injectJavaScript(`window.playAudio("${safeUri}"); true;`);
        },
        speakNative: (text: string, lang: string) => {
          const safeText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          webViewRef.current?.injectJavaScript(`window.speakNative("${safeText}", "${lang}"); true;`);
        },
        stop: () => {
          webViewRef.current?.injectJavaScript(`window.stopAudio(); true;`);
        },
        startListening: (lang: string) => {
          webViewRef.current?.injectJavaScript(`window.startListening("${lang}"); true;`);
        },
        stopListening: () => {
          webViewRef.current?.injectJavaScript(`window.stopListening(); true;`);
        },
      });
    }

    return () => {
      audioVoiceEngine.setNativeBridge(null);
    };
  }, []);

  if (Platform.OS === 'web') {
    return null;
  }

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'START') {
        audioVoiceEngine.onNativePlaybackStart();
      } else if (data.type === 'FINISH') {
        audioVoiceEngine.onNativePlaybackFinish();
      } else if (data.type === 'ERROR') {
        audioVoiceEngine.onNativePlaybackError(data.message);
      } else if (data.type === 'STOP') {
        audioVoiceEngine.onNativePlaybackStop();
      } else if (data.type === 'FREQUENCY') {
        audioVoiceEngine.onNativeFrequency(data.value);
      } else if (data.type === 'TRANSCRIPT') {
        audioVoiceEngine.onNativeTranscript(data.text, data.isFinal);
      } else if (data.type === 'AUDIO_RECORDED') {
        audioVoiceEngine.onNativeAudioRecorded(data.audioDataUri);
      }
    } catch (_) {}
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: AUDIO_BRIDGE_HTML, baseUrl: 'https://localhost' }}
        onMessage={handleMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        style={styles.hiddenWebView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        {...({
          onPermissionRequest: (event: any) => {
            try {
              if (event.request?.grant) {
                event.request.grant(event.request.resources);
              }
            } catch (_) {}
          },
        } as any)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    top: -100,
    left: -100,
    opacity: 0,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
