import React, { useEffect, useState } from 'react';
import { Loader2, Play, Square, Volume2 } from 'lucide-react';
import { api, Voice } from '../services/api';

interface VoiceSelectorProps {
  voiceId: string;
  voiceName: string;
  modelId: string;
  onChange: (voice: {
    voiceId: string;
    voiceName: string;
    modelId: string;
  }) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voiceId,
  voiceName,
  modelId,
  onChange,
}) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadVoices = async () => {
      try {
        const data = await api.getVoices();
        if (mounted) {
          setVoices(data);
        }
      } catch (_error) {
        // Fallback or empty voices handled gracefully
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadVoices();

    return () => {
      mounted = false;
    };
  }, []);

  const handlePreview = async () => {
    if (!voiceId) return;

    try {
      setPreviewing(true);

      if (audio) {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      }

      const blob = await api.synthesizeVoice({
        voiceId,
        text:
          'Thank you for calling. This is your AI receptionist. How may I assist you today?',
        modelId,
        languageCode: 'en',
        settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      });

      const url = URL.createObjectURL(blob);
      const newAudio = new Audio(url);

      setAudio(newAudio);

      newAudio.onended = () => {
        setPreviewing(false);
        URL.revokeObjectURL(url);
      };

      await newAudio.play();
    } catch (_error) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const sampleText = 'Thank you for calling. This is your AI receptionist. How may I assist you today?';
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.onend = () => setPreviewing(false);
        utterance.onerror = () => setPreviewing(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setPreviewing(false);
      }
    }
  };

  const handleStop = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      URL.revokeObjectURL(audio.src);
    }
    setPreviewing(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-700 font-semibold block mb-1">
          ElevenLabs Voice
        </label>

        <div className="flex gap-2">
          <select
            value={voiceId}
            disabled={loading}
            onChange={(e) => {
              const selected = voices.find(
                (voice) => voice.voice_id === e.target.value
              );

              if (!selected) return;

              onChange({
                voiceId: selected.voice_id,
                voiceName: selected.name,
                modelId,
              });
            }}
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">
              {loading ? 'Loading voices...' : 'Select a voice'}
            </option>

            {voices.map((voice) => (
              <option key={voice.voice_id} value={voice.voice_id}>
                {voice.name}
                {voice.category ? ` — ${voice.category}` : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!voiceId || previewing}
            onClick={handlePreview}
            className="px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
            title="Preview voice"
          >
            {previewing ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <Play className="w-4 h-4 text-slate-700 fill-slate-700" />
            )}
          </button>

          {previewing && (
            <button
              type="button"
              onClick={handleStop}
              className="px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Stop preview"
            >
              <Square className="w-4 h-4 text-rose-600 fill-rose-600" />
            </button>
          )}
        </div>
      </div>

      {voiceName && (
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Selected voice: <strong className="text-slate-900 font-semibold">{voiceName}</strong></span>
        </div>
      )}
    </div>
  );
};
