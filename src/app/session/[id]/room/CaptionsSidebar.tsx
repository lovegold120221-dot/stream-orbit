"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { getLanguageByCode } from "@/lib/languages";

interface TranslationEvent {
  type: string;
  kind?: string;
  source_identity?: string;
  target_lang?: string;
  final?: string;
  text?: string;
  streamInfo?: {
    attributes?: Record<string, string>;
    timestamp?: number;
  };
  participantInfo?: {
    identity?: string;
    attributes?: Record<string, string>;
  };
}

export default function CaptionsSidebar({
  open,
  onClose,
  myLang,
  peerLangs,
}: {
  open: boolean;
  onClose: () => void;
  myLang: string;
  peerLangs: Map<string, { lang: string | undefined; needsTranslation: boolean }>;
}) {
  const call = useCall();
  const { useRemoteParticipants } = useCallStateHooks();
  const remotes = useRemoteParticipants();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [translationEvents, setTranslationEvents] = useState<TranslationEvent[]>([]);

  // Listen for translation custom events from the translator agent
  useEffect(() => {
    if (!call) return;
    const handler = (event: any) => {
      if (event.custom?.type === "translation") {
        setTranslationEvents((prev) => [...prev, event.custom]);
      }
    };
    call.on("custom", handler);
    return () => call.off("custom", handler);
  }, [call]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of remotes) {
      map.set(p.userId, p.name || p.userId);
    }
    return map;
  }, [remotes]);

  // Convert peerLangs Map<string, {lang, needsTranslation}> to Map<string, string | undefined>
  const simplePeerLangs = useMemo(() => {
    const map = new Map<string, string | undefined>();
    peerLangs.forEach((v, k) => map.set(k, v.lang));
    return map;
  }, [peerLangs]);

  // Group source + translation text by speaker identity
  const entries = useMemo(() => {
    const matching = translationEvents
      .filter((s) => {
        const attrs = s.streamInfo?.attributes ?? s;
        return attrs.target_lang === myLang;
      })
      .sort((a, b) => (a.streamInfo?.timestamp ?? 0) - (b.streamInfo?.timestamp ?? 0));

    type Entry = {
      key: string;
      sourceIdentity: string;
      sourceText: string;
      translatedText: string;
      sourceLang: string | undefined;
    };
    const out: Entry[] = [];
    const openIdxBySource = new Map<string, number>();

    for (const s of matching) {
      const source = s.source_identity ?? s.participantInfo?.identity ?? s.streamInfo?.attributes?.source_identity ?? "";
      const isSource = s.kind === "source" || s.streamInfo?.attributes?.kind === "source";
      const isFinal = s.final === "true" || s.streamInfo?.attributes?.final === "true";
      const text = (s.text ?? "").trim();

      if (!text) {
        if (isFinal) openIdxBySource.delete(source);
        continue;
      }

      const openIdx = openIdxBySource.get(source);
      if (openIdx !== undefined) {
        if (isSource) {
          out[openIdx].sourceText = `${out[openIdx].sourceText} ${text}`.trim();
        } else {
          out[openIdx].translatedText = `${out[openIdx].translatedText} ${text}`.trim();
        }
      } else {
        out.push({
          key: `entry-${out.length}`,
          sourceIdentity: source,
          sourceText: isSource ? text : "",
          translatedText: isSource ? "" : text,
          sourceLang: simplePeerLangs.get(source),
        });
        openIdxBySource.set(source, out.length - 1);
      }

      if (isFinal) openIdxBySource.delete(source);
    }
    return out;
  }, [translationEvents, myLang, simplePeerLangs]);

  // Auto-scroll
  useEffect(() => {
    if (!open || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [entries, open]);

  const myLangInfo = getLanguageByCode(myLang);

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <span>Captions {myLangInfo && `· ${myLangInfo.flag} ${myLangInfo.name}`}</span>
        <button className="sidebar-close" onClick={onClose} aria-label="Close captions">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div ref={bodyRef} className="sidebar-body">
        {entries.length === 0 ? (
          <div className="captions-empty">
            No captions yet. Translation transcripts will appear here as people speak.
          </div>
        ) : (
          entries.map((entry) => {
            const parsedSource = parseSpeakerText(
              entry.sourceText,
              names.get(entry.sourceIdentity) ?? entry.sourceIdentity
            );
            const parsedTranslated = parseSpeakerText(
              entry.translatedText,
              "Orbit Translator"
            );
            return (
              <div className="captions-entry" key={entry.key}>
                {entry.sourceText && (
                  <p className="captions-text">
                    <strong>{parsedSource.speaker}:</strong>{" "}
                    {parsedSource.dialogue}
                  </p>
                )}
                {entry.translatedText && (
                  <p className="captions-text captions-text--translated">
                    <strong>
                      {parsedTranslated.speaker === "Orbit Translator"
                        ? "Orbit Translator"
                        : `${parsedTranslated.speaker} (Translated)`}
                      :
                    </strong>{" "}
                    {parsedTranslated.dialogue}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function parseSpeakerText(
  text: string,
  defaultSpeaker: string
): { speaker: string; dialogue: string } {
  const match = text.match(/^\[([^\]]+)\]\s*([\s\S]*)/);
  if (match) {
    return {
      speaker: match[1].trim(),
      dialogue: match[2].trim(),
    };
  }
  return {
    speaker: defaultSpeaker,
    dialogue: text,
  };
}
