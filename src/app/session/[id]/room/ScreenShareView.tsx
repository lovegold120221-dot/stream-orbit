"use client";

import { useEffect, useRef, useState } from "react";
import {
  useCall,
  useCallStateHooks,
  hasScreenShare,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { PARTICIPANT_LANG_ATTR, type ParticipantCustomData } from "@/lib/config";
import { getLanguageByCode } from "@/lib/languages";

/**
 * Detects when any participant is sharing their screen and renders
 * a large preview in the stage center with sharer info and translation
 * overlay. Returns null when no screen share is active.
 */
export default function ScreenShareView({
  myLang,
}: {
  myLang: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const call = useCall();
  const { useLocalParticipant, useRemoteParticipants } = useCallStateHooks();
  const localParticipant = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const [activeShare, setActiveShare] = useState<{
    participant: StreamVideoParticipant;
    stream: MediaStream | null;
  } | null>(null);

  // Collect all participants with screen share
  useEffect(() => {
    const sync = () => {
      // Check local participant first
      if (localParticipant && hasScreenShare(localParticipant)) {
        setActiveShare((prev) =>
          prev?.participant?.userId === localParticipant.userId && prev.stream === localParticipant.screenShareStream
            ? prev
            : { participant: localParticipant, stream: localParticipant.screenShareStream ?? null }
        );
        return;
      }
      // Then check remotes
      for (const p of remotes) {
        if (hasScreenShare(p)) {
          setActiveShare((prev) =>
            prev?.participant?.userId === p.userId && prev.stream === p.screenShareStream
              ? prev
              : { participant: p, stream: p.screenShareStream ?? null }
          );
          return;
        }
      }
      setActiveShare(null);
    };

    sync();
    const interval = setInterval(sync, 2000);
    return () => clearInterval(interval);
  }, [localParticipant, remotes]);

  // Attach/detach the screen share video track to our <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeShare?.stream) {
      if (video) video.srcObject = null;
      return;
    }
    video.srcObject = activeShare.stream;
    return () => {
      video.srcObject = null;
    };
  }, [activeShare?.stream]);

  if (!activeShare) return null;

  const participant = activeShare.participant;
  const displayName = participant.name || participant.userId;
  const isLocal = participant.userId === localParticipant?.userId;
  const speakerLang = (participant.custom as ParticipantCustomData)?.lang;
  const langInfo = speakerLang ? getLanguageByCode(speakerLang) : undefined;
  const needsTranslation = !!speakerLang && speakerLang !== myLang;

  return (
    <div className="screen-share-view">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="screen-share-video"
      />
      <div className="screen-share-overlay">
        <div className="screen-share-overlay-top">
          <div className="screen-share-info">
            <span className="screen-share-name">
              {displayName}
              {isLocal ? " (You)" : ""}
            </span>
            <span className="screen-share-label"> is sharing screen</span>
          </div>
          {isLocal && call && (
            <button
              className="screen-share-stop-btn"
              onClick={() => call.screenShare.disable().catch(() => {})}
            >
              Stop Sharing
            </button>
          )}
        </div>
        <div className="screen-share-overlay-bottom">
          {needsTranslation && (
            <span className="screen-share-status">
              &rarr; {getLanguageByCode(myLang)?.name || myLang} &middot; Orus
            </span>
          )}
          {langInfo && !isLocal && !needsTranslation && (
            <span className="active-speaker-lang-badge">
              {langInfo.flag} {langInfo.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
