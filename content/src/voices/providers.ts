export type Env = Record<string, string | undefined>;
export type Fetch = typeof fetch;

export interface Voice {
  /** Unique across providers. Names the clip files. */
  id: string;
  /** Shown after "reveal". */
  name: string;
}

export interface Provider {
  id: string;
  name: string;
  /** Env vars the provider needs. A missing one skips the provider. */
  keys: string[];
  voices: (env: Env) => Voice[];
  /** Returns MP3 bytes. */
  synthesize(text: string, voice: Voice, env: Env, fetchFn: Fetch): Promise<Uint8Array>;
}

/** The delivery prompt for providers that take one. */
export const DELIVERY =
  'Warm and slow, for a 6-year-old. Read numbers clearly. Smile in your voice.';

async function audio(response: Response, provider: string): Promise<Uint8Array> {
  if (!response.ok) {
    throw new Error(`${provider} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Voice ids are after the provider's prefix, so `google:en-US-Chirp3-HD-Aoede` calls Aoede.
const after = (voice: Voice) => voice.id.slice(voice.id.indexOf(':') + 1);

const google: Provider = {
  id: 'google',
  name: 'Google Cloud TTS (Chirp 3 HD)',
  keys: ['GOOGLE_TTS_API_KEY'],
  voices: () => [
    { id: 'google:en-US-Chirp3-HD-Aoede', name: 'Google Chirp 3 HD, Aoede (en-US)' },
    { id: 'google:en-US-Chirp3-HD-Leda', name: 'Google Chirp 3 HD, Leda (en-US)' },
  ],
  async synthesize(text, voice, env, fetchFn) {
    const name = after(voice);
    const response = await fetchFn('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        'x-goog-api-key': env.GOOGLE_TTS_API_KEY ?? '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: name.slice(0, 5), name },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
      }),
    });
    if (!response.ok) return audio(response, 'Google');
    const { audioContent } = (await response.json()) as { audioContent: string };
    return new Uint8Array(Buffer.from(audioContent, 'base64'));
  },
};

const azure: Provider = {
  id: 'azure',
  name: 'Azure Neural TTS',
  keys: ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'],
  voices: () => [
    { id: 'azure:en-CA-ClaraNeural', name: 'Azure Clara (en-CA)' },
    { id: 'azure:en-CA-LiamNeural', name: 'Azure Liam (en-CA)' },
    { id: 'azure:en-US-AvaMultilingualNeural', name: 'Azure Ava (en-US)' },
  ],
  async synthesize(text, voice, env, fetchFn) {
    const name = after(voice);
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${name.slice(0, 5)}">` +
      `<voice name="${name}"><prosody rate="-10%">${escapeXml(text)}</prosody></voice></speak>`;
    const response = await fetchFn(
      `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY ?? '',
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
          'User-Agent': 'bright-trail-voices',
        },
        body: ssml,
      },
    );
    return audio(response, 'Azure');
  },
};

// Rachel, a premade voice every account has. ELEVENLABS_VOICE_ID swaps in one from the library.
const ELEVENLABS_DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM';

const elevenlabs: Provider = {
  id: 'elevenlabs',
  name: 'ElevenLabs',
  keys: ['ELEVENLABS_API_KEY'],
  voices: (env) => {
    const id = env.ELEVENLABS_VOICE_ID ?? ELEVENLABS_DEFAULT_VOICE;
    const label = env.ELEVENLABS_VOICE_ID ? id : 'Rachel';
    return [{ id: `elevenlabs:${id}`, name: `ElevenLabs ${label} (multilingual v2)` }];
  },
  async synthesize(text, voice, env, fetchFn) {
    const response = await fetchFn(
      `https://api.elevenlabs.io/v1/text-to-speech/${after(voice)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY ?? '', 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      },
    );
    return audio(response, 'ElevenLabs');
  },
};

const openai: Provider = {
  id: 'openai',
  name: 'OpenAI gpt-4o-mini-tts',
  keys: ['OPENAI_API_KEY'],
  voices: () => [
    { id: 'openai:coral', name: 'OpenAI Coral' },
    { id: 'openai:sage', name: 'OpenAI Sage' },
  ],
  async synthesize(text, voice, env, fetchFn) {
    const response = await fetchFn('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: after(voice),
        input: text,
        instructions: DELIVERY,
        response_format: 'mp3',
      }),
    });
    return audio(response, 'OpenAI');
  },
};

export const PROVIDERS: Provider[] = [google, azure, elevenlabs, openai];

/** Splits providers into those with every key set and those missing one. */
export function availableProviders(
  env: Env,
  providers: Provider[] = PROVIDERS,
): { ready: Provider[]; skipped: { provider: Provider; missing: string[] }[] } {
  const ready: Provider[] = [];
  const skipped: { provider: Provider; missing: string[] }[] = [];
  for (const provider of providers) {
    const missing = provider.keys.filter((k) => !env[k]?.trim());
    if (missing.length === 0) ready.push(provider);
    else skipped.push({ provider, missing });
  }
  return { ready, skipped };
}
