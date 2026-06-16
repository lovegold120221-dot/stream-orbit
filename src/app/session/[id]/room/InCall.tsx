"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  useCall,
  useCallStateHooks,
  hasAudio,
  hasVideo,
  hasScreenShare,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { useRouter } from "next/navigation";
import { PARTICIPANT_LANG_ATTR, type ParticipantCustomData } from "@/lib/config";
import { getLanguageByCode } from "@/lib/languages";
import { useTranslationRouting } from "./useTranslationRouting";
import { useUser } from "@/context/UserContext";

import ControlBar from "./ControlBar";
import ParticipantsPanel from "./ParticipantsPanel";
import ChatSidebar from "./ChatSidebar";
import CaptionsSidebar from "./CaptionsSidebar";
import BreakoutSidebar from "./BreakoutSidebar";
import ScreenShareView from "./ScreenShareView";
import OrbitTranslationPanel from "./OrbitTranslationPanel";
import GalleryView from "./GalleryView";
import { SpeakerIcon, SpeakerOffIcon, ChevronDownIcon, LinkIcon, ShieldCheckIcon, FilmIcon } from "./icons";

export default function InCall({
  initialLang,
  onLeave,
}: {
  initialLang: string;
  onLeave: () => void;
}) {
  const call = useCall();
  const {
    useLocalParticipant,
    useRemoteParticipants,
    useHasOngoingScreenShare,
    useDominantSpeaker,
    useCallCallingState,
  } = useCallStateHooks();

  const localParticipant = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const hasScreenShare = useHasOngoingScreenShare();
  const dominantSpeaker = useDominantSpeaker();
  const callingState = useCallCallingState();
  const { profile } = useUser();

  const [lang, setLang] = useState(initialLang);
  const [translatorMuted, setTranslatorMuted] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState<"participants" | "captions" | "translation" | "chat" | "breakout" | null>("translation");
  const [speakerMuted, setSpeakerMuted] = useState(true);
  const [headerCopied, setHeaderCopied] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [contentType, setContentType] = useState<"normal" | "movie" | "cinematic_faithful">(
    profile?.content_type || "normal"
  );
  const router = useRouter();
  const isHost = typeof window !== "undefined" && window.sessionStorage.getItem("orbitHostRoom") === call?.id;

  const { peerLangs } = useTranslationRouting(
    lang,
    localParticipant?.userId ?? "",
    true,
    true,
    true,
    translatorMuted,
    speakerMuted,
  );

  // ── Listen for custom events (replaces LiveKit data channels) ──
  // Moderation events
  useEffect(() => {
    if (!call) return;
    const handler = (event: any) => {
      if (event.custom?.type === "REQUEST_VIDEO" && event.custom?.targetUserId === localParticipant?.userId) {
        if (confirm("The host has requested you to turn on your camera. Turn it on now?")) {
          call.camera.enable().catch(() => {});
        }
      }
    };
    call.on("custom", handler);
    return () => call.off("custom", handler);
  }, [call, localParticipant]);

  // Reactions
  const [reactions, setReactions] = useState<Map<string, { emoji: string; ts: number }>>(new Map());

  useEffect(() => {
    if (!call) return;
    const handler = (event: any) => {
      const data = event.custom;
      if (data?.type === "react" && data?.emoji && data?.fromId) {
        setReactions((prev) => {
          const next = new Map(prev);
          next.set(data.fromId, { emoji: data.emoji, ts: Date.now() });
          return next;
        });
        setTimeout(() => {
          setReactions((prev) => {
            const next = new Map(prev);
            next.delete(data.fromId);
            return next;
          });
        }, 4000);
      }
    };
    call.on("custom", handler);
    return () => call.off("custom", handler);
  }, [call]);

  // Breakout events
  useEffect(() => {
    if (!call) return;
    const handler = (event: any) => {
      try {
        const payload = event.custom;
        if (!payload) return;
        if (payload.type === "BREAKOUT_JOIN" && payload.newRoom) {
          const name = sessionStorage.getItem("lt.displayName") || localParticipant?.name || "participant";
          const savedLang = sessionStorage.getItem("lt.lang") || initialLang;
          sessionStorage.setItem("lt.displayName", name);
          sessionStorage.setItem("lt.lang", savedLang);
          if (payload.token) {
            sessionStorage.setItem("orbit.breakout-token", payload.token);
            sessionStorage.setItem("orbit.breakout-server-url", payload.serverUrl || "");
            if (payload.breakoutIdentity) {
              sessionStorage.setItem("orbit.breakout-identity", payload.breakoutIdentity);
            }
          }
          alert("You have been assigned to a breakout room. Moving now...");
          router.push(`/session/${payload.newRoom}/room?returnTo=${payload.originalRoom}`);
        } else if (payload.type === "BREAKOUT_END" && payload.originalRoom) {
          const name = sessionStorage.getItem("lt.displayName") || localParticipant?.name || "participant";
          const savedLang = sessionStorage.getItem("lt.lang") || initialLang;
          sessionStorage.setItem("lt.displayName", name);
          sessionStorage.setItem("lt.lang", savedLang);
          alert("Breakout session ended. Returning to main room...");
          router.push(`/session/${payload.originalRoom}/room`);
        }
      } catch {
        // Ignore non-JSON or unrelated messages
      }
    };
    call.on("custom", handler);
    return () => call.off("custom", handler);
  }, [call, localParticipant, initialLang, router]);

  const toggleSidebar = (sidebar: "participants" | "captions" | "translation" | "chat" | "breakout") => {
    setActiveSidebar((current) => (current === sidebar ? null : sidebar));
  };

  // ── Push local lang into participant custom data ──
  // Stream: use call.updateCallMembers() to broadcast custom data to all participants.
  // This replaces LiveKit's setAttributes().
  useEffect(() => {
    if (!call || !localParticipant) return;

    const apply = async () => {
      // Stream CallingState is an enum; "joined" is the string value
      if (callingState !== "joined" as any) return;
      try {
        const glossaryStr = profile?.glossary?.length
          ? JSON.stringify(profile.glossary)
          : "";
        await call.updateCallMembers({
          update_members: [{
            user_id: localParticipant.userId,
            custom: {
              lang: lang,
              orbit_hand: handRaised ? "raised" : "",
              orbit_host: isHost ? "true" : "",
              orbit_glossary: glossaryStr,
              orbit_content_type: contentType,
            },
          }],
        });
      } catch (err) {
        console.warn("[InCall] Failed to update custom attributes:", err);
      }
    };

    apply();
  }, [call, localParticipant, lang, handRaised, isHost, profile?.glossary, contentType, callingState]);

  // Sync local contentType state from the user profile when it loads/changes
  useEffect(() => {
    if (profile?.content_type) {
      setContentType(profile.content_type);
    }
  }, [profile?.content_type]);

  // ── Derived data ──
  // Filter out agent participants (identified by custom.is_agent flag)
  const humanRemotes = useMemo(
    () => remotes.filter((p) => !(p.custom as ParticipantCustomData)?.is_agent),
    [remotes],
  );

  const langInfo = getLanguageByCode(lang);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/session/${call?.id ?? ""}`
    : "";

  const shellClassName = `room-shell${
    activeSidebar ? ` room-shell--sidebar-open room-shell--${activeSidebar}-open` : ""
  }`;

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setHeaderCopied(true);
    setTimeout(() => setHeaderCopied(false), 2000);
  }

  return (
    <div className={shellClassName} data-sidebar={activeSidebar ?? "none"}>
      <div className="room">
        {/* Top chrome */}
        <header className="orbit-header">
          {/* Desktop Single Line Header */}
          <div className="orbit-topbar-desktop">
            <div className="orbit-topbar-left">
              <span className="orbit-titlebar-title">Orbit Meeting</span>
              <span className="orbit-translation-status orbit-translation-status-text">
                Translation: {langInfo?.name || lang}
              </span>
              <label
                className={`orbit-movie-toggle${contentType !== "normal" ? " active" : ""}${contentType === "cinematic_faithful" ? " faithful" : ""}`}
                title={
                  contentType === "normal"
                    ? "Content mode: Normal — click for Movie"
                    : contentType === "movie"
                    ? "Content mode: Movie dubbing — click for Cinematic Faithful"
                    : "Content mode: Cinematic Faithful — click to reset to Normal"
                }
                onClick={() => {
                  const cycle: Array<"normal" | "movie" | "cinematic_faithful"> = ["normal", "movie", "cinematic_faithful"];
                  const idx = cycle.indexOf(contentType);
                  setContentType(cycle[(idx + 1) % cycle.length]);
                }}
              >
                <FilmIcon />
                <span>{contentType === "normal" ? "Normal" : contentType === "movie" ? "Movie" : "Faithful"}</span>
              </label>
              <button
                className="orbit-view-btn"
                onClick={() => setTranslatorMuted(!translatorMuted)}
                title={translatorMuted ? "Unmute translator" : "Mute translator"}
                aria-label={translatorMuted ? "Unmute translator" : "Mute translator"}
              >
                {translatorMuted ? <SpeakerOffIcon /> : <SpeakerIcon />}
              </button>
            </div>
            
            <div className="orbit-topbar-right">
              <span className="orbit-room-id">{call?.id ?? ""}</span>
              <button
                className="orbit-copy-btn"
                onClick={copyShareLink}
                title={headerCopied ? "Copied!" : "Copy meeting link"}
                aria-label="Copy meeting link"
              >
                <LinkIcon />
                <span>{headerCopied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Mobile topbar content — hidden on desktop */}
          <div className="orbit-topbar-mobile">
            <button
              className="orbit-mobile-audio"
              aria-label={speakerMuted ? "Unmute speaker" : "Mute speaker"}
              onClick={() => setSpeakerMuted((v) => !v)}
            >
              {speakerMuted ? <SpeakerOffIcon /> : <SpeakerIcon />}
            </button>
            <button
              className="orbit-mobile-brand"
              onClick={() => toggleSidebar("translation")}
              aria-label="Open translation controls"
            >
              <ShieldCheckIcon style={{ color: "#22c55e", strokeWidth: 1.5, width: "18px", height: "18px" }} />
              <span>Orbit</span>
              <ChevronDownIcon />
            </button>
            <button className="orbit-mobile-leave" onClick={async () => { await call?.leave(); onLeave(); }}>
              Leave
            </button>
          </div>
        </header>

        {/* Stage */}
        <main className="room-stage orbit-stage">
          <div className="orbit-stage-center">
            {hasScreenShare ? (
              <ScreenShareView myLang={lang} />
            ) : (
              <GalleryView remotes={humanRemotes} myLang={lang} isHost={isHost} roomName={call?.id ?? ""} />
            )}
          </div>
          {/* Right Sidebar Panel */}
          {activeSidebar === "participants" && (
            <ParticipantsPanel 
              localParticipant={localParticipant}
              participants={humanRemotes} 
              myLang={lang} 
              isHost={isHost}
              roomName={call?.id ?? ""}
              onClose={() => setActiveSidebar(null)}
              onToggleChat={() => toggleSidebar("chat")}
              reactions={reactions}
            />
          )}
          {activeSidebar === "captions" && (
            <CaptionsSidebar
              open
              onClose={() => setActiveSidebar(null)}
              myLang={lang}
              peerLangs={peerLangs}
            />
          )}
          {activeSidebar === "translation" && (
            <OrbitTranslationPanel
              onClose={() => setActiveSidebar(null)}
              myLang={lang}
              onLangChange={setLang}
              translatorMuted={translatorMuted}
              onToggleTranslator={() => setTranslatorMuted((v) => !v)}
              peerLangs={peerLangs}
              roomName={call?.id ?? ""}
            />
          )}
          {activeSidebar === "chat" && (
            <ChatSidebar onClose={() => setActiveSidebar(null)} />
          )}
          {activeSidebar === "breakout" && (
            <BreakoutSidebar onClose={() => setActiveSidebar(null)} />
          )}
        </main>

        {/* Control bar */}
        <ControlBar
          onLeave={onLeave}
          activeSidebar={activeSidebar}
          onToggleSidebar={toggleSidebar}
          speakerMuted={speakerMuted}
          onToggleSpeaker={() => setSpeakerMuted((v) => !v)}
          handRaised={handRaised}
          onToggleHand={() => {
            const cur = (localParticipant?.custom as ParticipantCustomData)?.orbit_hand === "raised";
            setHandRaised(!cur);
          }}
        />
      </div>
    </div>
  );
}
