const RESPEECHER_TTS_URL = "https://api.respeecher.com/v1/public/tts/pt-br-rt/tts/bytes";
const REQUEST_TIMEOUT_MS = 30_000;

type TtsAudio = {
  audio: ArrayBuffer;
  contentType: string;
};

export async function gerarAudioTts(text: string): Promise<TtsAudio> {
  const apiKey = process.env["RESPEECHER_API_KEY"]?.trim();
  const voiceId = process.env["RESPEECHER_VOICE_ID"]?.trim();
  if (!apiKey || !voiceId) throw new Error("Respeecher não está configurado no servidor");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(RESPEECHER_TTS_URL, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: text, voice: { id: voiceId } }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Respeecher respondeu com status ${response.status} ${response.statusText}: ${await response.text()}`,
      );
    }
    return {
      audio: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "audio/wav",
    };
  } finally {
    clearTimeout(timeout);
  }
}
