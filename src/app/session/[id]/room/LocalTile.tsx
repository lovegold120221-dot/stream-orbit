"use client";

import { useEffect, useRef, useState } from "react";
import {
  useCallStateHooks,
  hasVideo,
  hasAudio,
} from "@stream-io/video-react-sdk";
import { MicOffIcon } from "./icons";

export default function LocalTile({ myLang }: { myLang: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();

  const cameraOn = localParticipant ? hasVideo(localParticipant) : false;
  const micOn = localParticipant ? hasAudio(localParticipant) : false;
  const isSpeaking = localParticipant?.isSpeaking ?? false;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (cameraOn && localParticipant?.videoStream) {
      video.srcObject = localParticipant.videoStream;
    } else {
      video.srcObject = null;
    }

    return () => {
      video.srcObject = null;
    };
  }, [localParticipant?.videoStream, cameraOn]);

  const displayName = localParticipant?.name || localParticipant?.userId || "You";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className={`tile${isSpeaking && micOn ? " tile-speaking" : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`tile-video local-tile-video-mirror ${cameraOn ? "" : "tile-video-hidden"}`}
      />
      {!cameraOn && (
        <div className="tile-placeholder">
          <span className="tile-placeholder-initial">{initial}</span>
        </div>
      )}

      {!micOn && (
        <div className="tile-mic-off" title="Microphone off">
          <MicOffIcon />
        </div>
      )}

      <div className="tile-name tile-name-wrapper">
        <div className="tile-name-row">
          <span className="tile-name-text">{displayName} (You)</span>
        </div>
      </div>
    </div>
  );
}
