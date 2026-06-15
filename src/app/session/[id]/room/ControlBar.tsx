"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  useLocalParticipant,
  useRoomContext,
  useTrackVolume,
} from "@livekit/components-react";
import { Track, LocalAudioTrack } from "livekit-client";
import { SpeakerIcon, SpeakerOffIcon } from "./icons";
import {
  CamOffIcon,
  CamOnIcon,
  CaptionsIcon,
  MicOffIcon,
  MicOnIcon,
  ParticipantsIcon,
  ChatIcon,
  ShareScreenIcon,
  TranslateIcon,
  RecordIcon,
  MoreIcon,
  BreakoutRoomsIcon,
  SettingsIcon,
  HistoryIcon,
  LinkIcon,
  CaretUpIcon,
  HandRaiseIcon,
} from "./icons";

type NativeScreenShareBridge = {
  startScreenShare: () => void;
  stopScreenShare: () => void;
};

type NativeScreenShareWindow = Window & {
  NativeScreenShare?: NativeScreenShareBridge;
  onNativeScreenShareFrame?: (dataUrl: string) => void;
};

function getNativeScreenShareBridge() {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as NativeScreenShareWindow).NativeScreenShare;
}

function getShareErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError")) {
    return "Screen sharing was cancelled.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function waitForNativeScreenShareFrame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  return new Promise<void>((resolve, reject) => {
    let ready = false;
    const timeout = window.setTimeout(() => {
      if (!ready) {
        reject(new Error("Screen capture permission did not return a frame."));
      }
    }, 12000);

    (window as unknown as NativeScreenShareWindow).onNativeScreenShareFrame = (dataUrl: string) => {
      if (dataUrl === "error:PermissionDenied") {
        if (!ready) {
          window.clearTimeout(timeout);
          reject(new Error("Screen capture permission was denied."));
        }
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (!ready) {
          canvas.width = img.naturalWidth || 360;
          canvas.height = img.naturalHeight || 640;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (!ready) {
          ready = true;
          window.clearTimeout(timeout);
          resolve();
        }
      };
      img.onerror = () => {
        if (!ready) {
          window.clearTimeout(timeout);
          reject(new Error("The native screen capture frame could not be decoded."));
        }
      };
      img.src = dataUrl;
    };
  });
}

export default function ControlBar({
  onLeave,
  activeSidebar,
  onToggleSidebar,
  speakerMuted,
  onToggleSpeaker,
  handRaised,
  onToggleHand,
}: {
  onLeave: () => void;
  activeSidebar: "participants" | "captions" | "translation" | "chat" | "breakout" | null;
  onToggleSidebar: (sidebar: "participants" | "captions" | "translation" | "chat" | "breakout") => void;
  speakerMuted: boolean;
  onToggleSpeaker: () => void;
  handRaised: boolean;
  onToggleHand: () => void;
}) {
  const { localParticipant, microphoneTrack, cameraTrack } = useLocalParticipant();
  const room = useRoomContext();
  const router = useRouter();
  const [isLocalRecording, setIsLocalRecording] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareWithAudio, setShareWithAudio] = useState(true);
  const [shareStarting, setShareStarting] = useState(false);
  const [shareError, setShareError] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const customScreenShareTrackRef = useRef<MediaStreamTrack | null>(null);
  const [customScreenShareOn, setCustomScreenShareOn] = useState(false);
  const shareConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const REACTIONS = ["✋", "👍", "👏", "😂", "❤️", "🎉", "🙌", "💯"];

  const sendReaction = (emoji: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({
      emoji,
      from: localParticipant.name || localParticipant.identity,
      fromId: localParticipant.identity,
    }));
    localParticipant.publishData(data, { topic: "react", reliable: true });
    onToggleHand();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const micOn = !!microphoneTrack && !microphoneTrack.isMuted;
  const camOn =
    !!cameraTrack &&
    cameraTrack.source === Track.Source.Camera &&
    !cameraTrack.isMuted;
  const screenShareOn = localParticipant.isScreenShareEnabled;
  const nativeScreenShare = getNativeScreenShareBridge();
  const browserScreenShareSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);
  const screenShareActive = screenShareOn || customScreenShareOn;
  const screenAudioAvailable = !nativeScreenShare;
  const canStartScreenShare = Boolean(nativeScreenShare || browserScreenShareSupported);

  useEffect(() => {
    if (!showShareDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !shareStarting) {
        setShowShareDialog(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      shareConfirmButtonRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [showShareDialog, shareStarting]);

  async function toggleMic() {
    await localParticipant.setMicrophoneEnabled(!micOn);
  }
  async function toggleCam() {
    await localParticipant.setCameraEnabled(!camOn);
  }
  async function handleShareScreen() {
    if (screenShareActive) {
      await stopShareScreen();
      return;
    }

    setShareError("");
    setShowMoreMenu(false);
    setShowReactions(false);
    setShowShareDialog(true);
  }

  async function stopShareScreen() {
    setShareError("");
    setShareStarting(false);

    const nativeShare = getNativeScreenShareBridge();
    if (nativeShare) {
      nativeShare.stopScreenShare();
      delete (window as unknown as NativeScreenShareWindow).onNativeScreenShareFrame;
    }

    if (customScreenShareTrackRef.current) {
      const track = customScreenShareTrackRef.current;
      track.stop();
      await localParticipant.unpublishTrack(track);
      customScreenShareTrackRef.current = null;
      setCustomScreenShareOn(false);
    }

    if (screenShareOn) {
      await localParticipant.setScreenShareEnabled(false);
    }
  }

  async function confirmShareScreen() {
    const nativeShare = getNativeScreenShareBridge();
    if (!nativeShare && !browserScreenShareSupported) {
      setShareError("Screen sharing is not available in this browser.");
      return;
    }

    setShareError("");
    setShareStarting(true);

    if (nativeShare) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 360;
        canvas.height = 640;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not create a screen share canvas.");
        }

        const firstFrame = waitForNativeScreenShareFrame(canvas, ctx);
        nativeShare.startScreenShare();
        await firstFrame;

        const stream = canvas.captureStream(8);
        const track = stream.getVideoTracks()[0];
        if (!track) {
          throw new Error("Could not create a native screen share track.");
        }
        customScreenShareTrackRef.current = track;
        track.addEventListener("ended", () => {
          customScreenShareTrackRef.current = null;
          setCustomScreenShareOn(false);
        });

        await localParticipant.publishTrack(track, {
          name: "screen",
          source: Track.Source.ScreenShare,
        });
        setCustomScreenShareOn(true);
        setShowShareDialog(false);
      } catch (e: unknown) {
        nativeShare.stopScreenShare();
        delete (window as unknown as NativeScreenShareWindow).onNativeScreenShareFrame;
        setShareError(`Failed to start native screen share: ${getShareErrorMessage(e)}`);
      } finally {
        setShareStarting(false);
      }
      return;
    }

    try {
      await localParticipant.setScreenShareEnabled(true, {
        audio: shareWithAudio,
        video: true,
        systemAudio: shareWithAudio ? "include" : "exclude",
        surfaceSwitching: "include",
        selfBrowserSurface: "include",
        contentHint: "detail",
      });
      setShowShareDialog(false);
    } catch (e: unknown) {
      setShareError(`Failed to start screen share: ${getShareErrorMessage(e)}`);
    } finally {
      setShareStarting(false);
    }
  }
  async function toggleRecording() {
    if (isLocalRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsLocalRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        // @ts-expect-error - preferCurrentTab is a relatively new API flag not in all TS definitions
        preferCurrentTab: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      let recordedBlob: Blob | null = null;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        recordedBlob = new Blob(chunks, { type: "video/webm" });
        const filename = `orbit-recording-${room.name}-${Date.now()}.webm`;

        // Try File System Access API: showSaveFilePicker lets user pick save location
        try {
          // @ts-expect-error - File System Access API types from WICG spec
          const fileHandle = await window.showSaveFilePicker?.({
            suggestedName: filename,
            types: [{ description: 'WebM Video', accept: { 'video/webm': ['.webm'] } }],
          });
          if (fileHandle) {
            const writable = await (fileHandle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
            await writable.write(recordedBlob);
            await writable.close();
            stream.getTracks().forEach((t) => t.stop());
            setIsLocalRecording(false);
            return;
          }
        } catch (_saveErr: unknown) {
          if ((_saveErr as Error)?.name !== 'AbortError') {
            console.warn("showSaveFilePicker failed, falling back to download:", _saveErr);
          }
        }

        // Fallback: download via <a> tag
        const url = URL.createObjectURL(recordedBlob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        stream.getTracks().forEach((t) => t.stop());
        setIsLocalRecording(false);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsLocalRecording(true);

      // Stop recording if the user closes the screen share via the browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Failed to start screen recording: " + msg);
      setIsLocalRecording(false);
    }
  }
  function toggleBreakout() {
    onToggleSidebar("breakout");
  }
  async function leave() {
    await room.disconnect();
    onLeave();
  }

  return (
    <div className="control-bar">
      {/* ——— Left: Audio / Video ——— */}
      <div className="control-bar-left">
        <MicButton
          micOn={micOn}
          toggleMic={toggleMic}
          microphoneTrack={microphoneTrack?.track as LocalAudioTrack | undefined}
        />
        <CtrlButton
          active={camOn}
          onClick={toggleCam}
          label="Video"
          icon={camOn ? <CamOnIcon /> : <CamOffIcon />}
          dataMobile="primary"
          hasCaret
        />
        <CtrlButton
          active={speakerMuted}
          onClick={onToggleSpeaker}
          label="Speaker"
          icon={speakerMuted ? <SpeakerOffIcon /> : <SpeakerIcon />}
          dataMobile="overflow"
        />
      </div>

      {/* ——— Center: Features ——— */}
      <div className="control-bar-center">
        <CtrlButton
          active={activeSidebar === "participants"}
          onClick={() => onToggleSidebar("participants")}
          label="People"
          icon={<ParticipantsIcon />}
          dataMobile="overflow"
          hasCaret
        />
        {/* Mobile "People" alias */}
        <CtrlButton
          active={activeSidebar === "participants"}
          onClick={() => onToggleSidebar("participants")}
          label="People"
          icon={<ParticipantsIcon />}
          dataMobile="primary-people"
        />
        <CtrlButton
          active={activeSidebar === "chat"}
          onClick={() => onToggleSidebar("chat")}
          label="Chat"
          icon={<ChatIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={screenShareActive}
          onClick={handleShareScreen}
          label={screenShareActive ? "Stop Share" : "Share"}
          icon={<ShareScreenIcon />}
          dataMobile="primary-share"
          hasCaret
          className="ctrl-share"
        />
        <CtrlButton
          active={activeSidebar === "translation"}
          onClick={() => onToggleSidebar("translation")}
          label="Translate"
          icon={<TranslateIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={isLocalRecording}
          onClick={toggleRecording}
          label="Record"
          icon={<RecordIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={activeSidebar === "breakout"}
          onClick={toggleBreakout}
          label="Breakout"
          icon={<BreakoutRoomsIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={showReactions || handRaised}
          onClick={() => setShowReactions((v) => !v)}
          label="React"
          icon={<HandRaiseIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={copied}
          onClick={handleCopyLink}
          label={copied ? "Copied" : "Link"}
          icon={<LinkIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={false}
          onClick={() => router.push("/settings")}
          label="Settings"
          icon={<SettingsIcon />}
          dataMobile="overflow"
        />
        <CtrlButton
          active={false}
          onClick={() => router.push("/history")}
          label="History"
          icon={<HistoryIcon />}
          dataMobile="overflow"
        />
      </div>

      {/* ——— Right: Leave & More ——— */}
      <div className="control-bar-right">
        <button
          className="ctrl ctrl--warning ctrl-leave ctrl-desktop-leave"
          onClick={leave}
          title="Leave the call"
          aria-label="Leave"
        >
          Leave
        </button>
        {/* Mobile only */}
        <CtrlButton
          active={showMoreMenu}
          onClick={() => setShowMoreMenu((v) => !v)}
          label="More"
          icon={<MoreIcon />}
          dataMobile="more"
        />
      </div>

      {/* ——— Mobile "More" Menu ——— */}
      {showMoreMenu && (
        <div className="mobile-more-overlay" onClick={() => setShowMoreMenu(false)}>
          <div
            className="mobile-more-menu"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="More meeting options"
          >
            <div className="mobile-more-header">
              <h3>More Options</h3>
              <button className="mobile-more-close" onClick={() => setShowMoreMenu(false)} title="Close menu" aria-label="Close menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="mobile-more-content">
              <button className="mobile-more-item" onClick={() => { onToggleSidebar("chat"); setShowMoreMenu(false); }}>
                <ChatIcon /> <span>Chat</span>
              </button>
              <button className="mobile-more-item" onClick={() => { onToggleSidebar("translation"); setShowMoreMenu(false); }}>
                <TranslateIcon /> <span>Translate</span>
              </button>
              <button className="mobile-more-item" onClick={() => { onToggleSidebar("captions"); setShowMoreMenu(false); }}>
                <CaptionsIcon /> <span>Captions</span>
              </button>
              <button className="mobile-more-item" onClick={() => { toggleRecording(); setShowMoreMenu(false); }}>
                <RecordIcon /> <span>{isLocalRecording ? "Stop Recording" : "Record"}</span>
              </button>
              <button className="mobile-more-item" onClick={() => { toggleBreakout(); setShowMoreMenu(false); }}>
                <BreakoutRoomsIcon /> <span>Breakout</span>
              </button>
              <button className="mobile-more-item" onClick={() => { onToggleSpeaker(); setShowMoreMenu(false); }}>
                {speakerMuted ? <SpeakerOffIcon /> : <SpeakerIcon />} <span>Speaker</span>
              </button>
              <button className="mobile-more-item" onClick={() => { handleCopyLink(); setShowMoreMenu(false); }}>
                <LinkIcon /> <span>{copied ? "Copied" : "Link"}</span>
              </button>
              <button className="mobile-more-item" onClick={() => { router.push("/settings"); setShowMoreMenu(false); }}>
                <SettingsIcon /> <span>Settings</span>
              </button>
              <button className="mobile-more-item" onClick={() => { router.push("/history"); setShowMoreMenu(false); }}>
                <HistoryIcon /> <span>History</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reaction picker */}
      {showReactions && (
        <div className="reaction-picker">
          {REACTIONS.map((r) => (
            <button key={r} className="reaction-btn" onClick={() => { sendReaction(r); setShowReactions(false); }}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* ——— Share Screen Dialog ——— */}
      {showShareDialog && mounted && createPortal(
        <div
          className="share-dialog-overlay"
          onClick={() => {
            if (!shareStarting) setShowShareDialog(false);
          }}
        >
          <section
            className="share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
            aria-describedby="share-dialog-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="share-dialog-header">
              <span className="share-dialog-icon" aria-hidden>
                <ShareScreenIcon />
              </span>
              <div>
                <h3 className="share-dialog-title" id="share-dialog-title">Share screen</h3>
                <p className="share-dialog-desc" id="share-dialog-desc">
                  Start a screen share for this meeting.
                </p>
              </div>
              <button
                type="button"
                className="share-dialog-close"
                onClick={() => setShowShareDialog(false)}
                disabled={shareStarting}
                aria-label="Close share screen dialog"
              >
                <span aria-hidden>×</span>
              </button>
            </div>

            {!canStartScreenShare && (
              <div className="share-dialog-error" role="status">
                Screen sharing is not available in this browser.
              </div>
            )}

            {shareError && (
              <div className="share-dialog-error" role="alert">
                {shareError}
              </div>
            )}

            <label className={`share-dialog-option${screenAudioAvailable ? "" : " share-dialog-option--disabled"}`}>
              <span className="share-dialog-option-icon">
                <SpeakerIcon />
              </span>
              <span className="share-dialog-option-text">
                <strong>Computer sound</strong>
                <small>{screenAudioAvailable ? "Include system audio when supported" : "Not available for this share mode"}</small>
              </span>
              <input
                type="checkbox"
                checked={screenAudioAvailable && shareWithAudio}
                onChange={(e) => setShareWithAudio(e.target.checked)}
                disabled={!screenAudioAvailable || shareStarting}
                aria-label="Share computer sound"
              />
            </label>

            <div className="share-dialog-actions">
              <button
                type="button"
                className="share-dialog-btn share-dialog-btn-cancel"
                disabled={shareStarting}
                onClick={() => setShowShareDialog(false)}
              >
                Cancel
              </button>
              <button
                ref={shareConfirmButtonRef}
                type="button"
                className="share-dialog-btn share-dialog-btn-confirm"
                disabled={shareStarting || !canStartScreenShare}
                onClick={confirmShareScreen}
              >
                {shareStarting ? "Starting..." : "Share"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}

function MicButton({
  micOn,
  toggleMic,
  microphoneTrack,
}: {
  micOn: boolean;
  toggleMic: () => void;
  microphoneTrack?: LocalAudioTrack;
}) {
  const volume = useTrackVolume(microphoneTrack);
  const isSpeaking = micOn && volume > 0.05;
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.setProperty('--volume-opacity', isSpeaking ? String(Math.min(0.8, volume * 2)) : '0');
      wrapperRef.current.style.setProperty('--volume-scale', isSpeaking ? String(1 + (volume * 0.5)) : '1');
    }
  }, [isSpeaking, volume]);

  return (
    <div ref={wrapperRef} className="mic-btn-wrapper">
      <CtrlButton
        active={micOn}
        onClick={toggleMic}
        label={micOn ? "Mute" : "Unmute"}
        icon={micOn ? <MicOnIcon /> : <MicOffIcon />}
        dataMobile="primary"
        muted={!micOn}
        hasCaret
        className="mic-btn"
      />
    </div>
  );
}

function CtrlButton({
  active,
  onClick,
  label,
  icon,
  dataMobile,
  hasCaret,
  muted,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  dataMobile?: string;
  hasCaret?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`ctrl${active ? " ctrl--active" : ""}${muted ? " ctrl--muted" : ""} ${className}`.trim()}
      onClick={onClick}
      title={label}
      aria-label={label}
      data-mobile={dataMobile}
    >
      <span className="ctrl-icon-row">
        <span className="ctrl-icon">{icon}</span>
        {hasCaret && <span className="ctrl-caret"><CaretUpIcon /></span>}
      </span>
      <span className="ctrl-label">{label}</span>
    </button>
  );
}
