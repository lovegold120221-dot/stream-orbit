/**
 * POST /api/translate-voice
 *
 * Uses the Gemini REST API to transcribe+translate an audio clip in one call.
 * Accepts base64-encoded 16 kHz mono 16-bit PCM audio (captured via
 * MediaRecorder on the client).
 *
 * Body:
 *   { audio: string,        // base64 PCM data
 *     sourceLang: string,   // BCP-47 source language code, e.g. "en"
 *     targetLang: string }  // BCP-47 target language code, e.g. "fr"
 *
 * Returns:
 *   { transcription: string,
 *     translation: string }
 */

import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-lite";

interface TranslateVoiceBody {
  audio?: string;
  mimeType?: string;
  sourceLang?: string;
  targetLang?: string;
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured on server" },
      { status: 500 },
    );
  }

  // ── Parse & validate ──────────────────────────────────────────────

  let body: TranslateVoiceBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { audio, mimeType, sourceLang, targetLang } = body;
  if (!audio || !sourceLang || !targetLang) {
    return NextResponse.json(
      {
        error: "Missing required fields: audio, sourceLang, targetLang",
      },
      { status: 400 },
    );
  }

  // Reject anything too large — ~3 MB raw PCM ≈ ~95 s of audio @ 16 kHz
  if (audio.length > 5_000_000) {
    return NextResponse.json(
      { error: "Audio too large (max ~95 seconds)" },
      { status: 400 },
    );
  }

  const mime = mimeType || "audio/pcm;rate=16000";

  // ── Call Gemini REST API with inline audio ────────────────────────

  const prompt = `You are a professional real-time translator.

Instructions:
1. First, transcribe the audio content in the source language ('${sourceLang}').
2. Then, translate the transcribed text into the target language ('${targetLang}').
3. Output your response as JSON with exactly two fields: "transcription" and "translation".
4. The transcription should be the exact text spoken in the source language.
5. The translation should be a natural, fluent translation in the target language — use natural contractions, common idioms, and colloquial flow appropriate to the target language. Never produce translationese or stilted phrasing.

Audio format: ${mime}

Transcription:
<translation>
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mime,
                  data: audio,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("Eburon API error:", response.status, errBody.slice(0, 500));
      return NextResponse.json(
        { error: `Eburon API returned ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("Unexpected Eburon response:", JSON.stringify(data).slice(0, 500));
      return NextResponse.json(
        { error: "Eburon returned an empty response" },
        { status: 502 },
      );
    }

    // Parse the JSON response containing transcription + translation.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        {
          transcription: text.trim(),
          translation: "",
          error: "Could not parse Eburon response as JSON",
        },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      transcription: parsed.transcription || "",
      translation: parsed.translation || "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("translate-voice route error:", msg);
    return NextResponse.json(
      { error: "Translation request failed" },
      { status: 502 },
    );
  }
}
