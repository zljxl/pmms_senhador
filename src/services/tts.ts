async function prepararAudio(text: string): Promise<HTMLAudioElement> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("Não foi possível gerar o áudio");

  const url = URL.createObjectURL(await response.blob());
  const audio = new Audio(url);
  const limpar = () => URL.revokeObjectURL(url);
  audio.onended = limpar;
  audio.onerror = limpar;
  return audio;
}

export async function speak(text: string): Promise<void> {
  await tocar(await prepararAudio(text));
}

let filaDeAnuncios: Promise<void> = Promise.resolve();

export function announce(text: string): Promise<void> {
  const anuncio = filaDeAnuncios.then(async () => {
    // A geração do TTS começa antes da campainha para reduzir o silêncio após ela.
    const audioTts = prepararAudio(text).catch((error) => {
      console.error("Falha ao gerar o TTS:", error);
      return null;
    });
    const campainha = new Audio("/freesound_community-ding-47489.mp3");

    // A campainha sempre toca, mesmo se o Respeecher falhar.
    await tocar(campainha);
    const audio = await audioTts;
    if (audio) await tocar(audio);
  });
  filaDeAnuncios = anuncio.catch((error) => console.error("Falha no anúncio TTS:", error));
  return anuncio;
}

function tocar(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Não foi possível reproduzir o áudio"));
    void audio.play().catch(reject);
  });
}
