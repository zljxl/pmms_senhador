import { NextResponse } from "next/server";
import { gerarAudioTts } from "@/services/tts.service.server";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 300;
const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = {
  audio: ArrayBuffer;
  contentType: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const text =
    typeof body === "object" && body !== null && "text" in body
      ? (body as { text?: unknown }).text
      : undefined;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text é obrigatório" }, { status: 400 });
  }

  const normalizedText = text.trim();
  if (normalizedText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "text excede o limite permitido" }, { status: 400 });
  }

  const voiceId = process.env["RESPEECHER_VOICE_ID"]?.trim();
  const cacheKey = `${voiceId ?? ""}:${normalizedText}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return new Response(cached.audio, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const { audio, contentType } = await gerarAudioTts(normalizedText);

    cache.set(cacheKey, {
      audio,
      contentType,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return new Response(audio, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erro no TTS Respeecher", error);
    return NextResponse.json({ error: "Serviço TTS indisponível" }, { status: 502 });
  }
}
