"use client";

import { useEffect, useRef, useState } from "react";
import {
  useCallStateHooks,
  hasVideo,
  hasAudio,
  hasScreenShare,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { NATIVE_LANG, PARTICIPANT_LANG_ATTR, type ParticipantCustomData } from "@/lib/config";
import { getLanguageByCode } from "@/lib/languages";
import { MicOffIcon } from "./icons";

export default function ParticipantTile({
  participant,
  myLang,
  isHost,
  roomName,
}: {
  participant: StreamVideoParticipant;
  myLang: string;
  isHost?: boolean;
  roomName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();

  const cameraOn = hasVideo(participant);
  const micOn = hasAudio(participant);
  const isSpeaking = participant.isSpeaking ?? false;

  const speakerLang = (participant.custom as ParticipantCustomData)?.lang;
  const langInfo = speakerLang ? getLanguageByCode(speakerLang) : undefined;

  const handleModerate = async (action: 'kick' | 'mute') => {
    if (!roomName) return;
    try {
      const response = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, roomName, identity: participant.userId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(err.error || `Failed to ${action} participant`);
      }
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const displayName = participant.name || participant.userId;
  const initial = displayName.slice(0, 1).toUpperCase();
  const isLocal = participant.userId === localParticipant?.userId;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (cameraOn && participant.videoStream) {
      video.srcObject = participant.videoStream;
    } else {
      video.srcObject = null;
    }

    return () => {
      video.srcObject = null;
    };
  }, [participant.videoStream, cameraOn]);

  return (
    <div className={`participant-tile${isSpeaking ? " participant-tile--speaking" : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`participant-tile-video${cameraOn ? "" : " hidden"}`}
      />
      {!cameraOn && (
        <div className="participant-tile-placeholder">
          <span className="participant-tile-initial">{initial}</span>
        </div>
      )}

      {/* Overlay */}
      <div className="participant-tile-overlay">
        <div className="participant-tile-info">
          <span className="participant-tile-name">
            {displayName}{isLocal ? " (You)" : ""}
          </span>
          <span className="participant-tile-mic">
            {micOn ? null : <MicOffIcon />}
          </span>
        </div>
        {langInfo && (
          <span className="participant-tile-lang">
            {langInfo.flag} {langInfo.name}
          </span>
        )}
      </div>

      {/* Host controls */}
      {isHost && !isLocal && (
        <div className="participant-tile-actions">
          <button
            className="participant-tile-action-btn"
            onClick={() => handleModerate('mute')}
            title="Mute participant"
          >
            Mute
          </button>
          <button
            className="participant-tile-action-btn participant-tile-action-btn--danger"
            onClick={() => handleModerate('kick')}
            title="Remove participant"
          >
            Kick
          </button>
        </div>
      )}
    </div>
  );
}
