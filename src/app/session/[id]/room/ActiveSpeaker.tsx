"use client";

import { useEffect, useRef, useState } from "react";
import {
  useCallStateHooks,
  hasVideo,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { PARTICIPANT_LANG_ATTR, type ParticipantCustomData } from "@/lib/config";
import { getLanguageByCode } from "@/lib/languages";

/**
 * Large center tile showing the active speaker with an Orbit highlight border
 * and optional translation status overlay.
 */
export default function ActiveSpeaker({
  participant,
  myLang,
}: {
  participant: StreamVideoParticipant | null;
  myLang: string;
}) {
  if (!participant) {
    return (
      <div className="active-speaker-wrap">
        <div className="active-speaker-empty-inner">
          <span className="active-speaker-placeholder-text">
            No active speaker
          </span>
        </div>
      </div>
    );
  }

  return <ActiveSpeakerInner participant={participant} myLang={myLang} />;
}

function ActiveSpeakerInner({
  participant,
  myLang,
}: {
  participant: StreamVideoParticipant;
  myLang: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraOn = hasVideo(participant);
  const isSpeaking = participant.isSpeaking ?? false;

  const speakerLang = (participant.custom as ParticipantCustomData)?.lang;
  const langInfo = speakerLang ? getLanguageByCode(speakerLang) : undefined;
  const needsTranslation = !!speakerLang && speakerLang !== myLang;

  const displayName = participant.name || participant.userId;
  const initial = displayName.slice(0, 1).toUpperCase();

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
    <div className={`active-speaker-wrap${isSpeaking ? " active-speaker-speaking" : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`active-speaker-video${cameraOn ? "" : " hidden"}`}
      />
      {!cameraOn && (
        <div className="active-speaker-placeholder">
          <span className="active-speaker-initial">{initial}</span>
        </div>
      )}

      {/* Bottom overlay: name + translation status */}
      <div className="active-speaker-overlay">
        <span className="active-speaker-name">{displayName}</span>
        {needsTranslation && isSpeaking && (
          <span className="active-speaker-status">
            Translating to {getLanguageByCode(myLang)?.name || myLang} &middot; Orus
          </span>
        )}
        {langInfo && !isSpeaking && (
          <span className="active-speaker-lang-badge">
            {langInfo.flag} {langInfo.name}
          </span>
        )}
      </div>
    </div>
  );
}
