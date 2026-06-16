"use client";

import { useEffect, useRef } from "react";
import {
  useCallStateHooks,
  hasVideo,
} from "@stream-io/video-react-sdk";

export default function SelfView() {
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraOn = localParticipant ? hasVideo(localParticipant) : false;

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

  const displayName = localParticipant?.name || "you";

  return (
    <div className="self-view">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="self-view-video"
        style={{ display: cameraOn ? "block" : "none" }}
      />
      {!cameraOn && (
        <div className="self-view-empty">
          <span>{displayName}</span>
        </div>
      )}
    </div>
  );
}
