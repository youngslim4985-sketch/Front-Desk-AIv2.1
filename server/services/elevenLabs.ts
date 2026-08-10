export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

export interface ElevenLabsVoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';

export const FALLBACK_VOICES: ElevenLabsVoice[] = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'Calm & Professional' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'Empathic & Friendly' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'Soft & Warm' },
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'Executive & Polished' },
  { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'Energetic & Expressive' },
  { voice_id: 'TxGEqhhqchac8P4fqD03', name: 'Josh', category: 'Deep & Confident' },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', category: 'Crisp & Authoritative' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'Clear & Conversational' },
];

function getApiKey(): string | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return apiKey;
}

export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return FALLBACK_VOICES;
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/v2/voices`, {
      headers: {
        'xi-api-key': apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return FALLBACK_VOICES;
    }

    const data = await response.json();
    return data.voices && data.voices.length > 0 ? data.voices : FALLBACK_VOICES;
  } catch (_err) {
    return FALLBACK_VOICES;
  }
}

export async function synthesizeElevenLabsSpeech({
  voiceId,
  text,
  modelId = 'eleven_multilingual_v2',
  languageCode = 'en',
  settings,
}: {
  voiceId: string;
  text: string;
  modelId?: string;
  languageCode?: string;
  settings?: ElevenLabsVoiceSettings;
}): Promise<Buffer> {
  if (!voiceId) {
    throw new Error('ElevenLabs voiceId is required');
  }

  if (!text.trim()) {
    throw new Error('Text is required for speech synthesis');
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        language_code: languageCode,
        voice_settings: {
          stability: settings?.stability ?? 0.5,
          similarity_boost: settings?.similarity_boost ?? 0.75,
          style: settings?.style ?? 0,
          use_speaker_boost: settings?.use_speaker_boost ?? true,
        },
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('ElevenLabs API key is invalid or unauthorized');
    }
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs synthesis status ${response.status}: ${errorText}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
