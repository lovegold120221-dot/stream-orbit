"use client";

import { useEffect } from "react";
import {
  useCall,
  useCallStateHooks,
  hasAudio,
  hasVideo,
  hasScreenShare,
  hasScreenShareAudio,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { NATIVE_LANG, PARTICIPANT_LANG_ATTR, type ParticipantCustomData } from "@/lib/config";

// Stream doesn't have named tracks like LiveKit. Instead, we rely on:
// - participant.custom (set via call.updateCallMembers) for language attributes
// - participant.isSpeaking for active speaker detection
// - participant.audioStream / videoStream / screenShareStream for media

/**
 * Subscribes/unsubscribes to audio tracks based on the listener's chosen
 * language and preferences. Stream handles subscriptions automatically,
 * so this hook focuses on volume control and translation awareness.
 *
 * In the Stream model:
 * - All participants' audio is auto-subscribed (managed by Stream SFU)
 * - Volume control per participant via speaker.setParticipantVolume(sessionId, vol)
 * - Translation awareness via participant.custom properties
 * - Agent detection via participant.custom.is_agent flag
 *
 * This hook exists primarily for:
 * 1. Speaker volume control (mute/unmute speaker)
 * 2. Translator mute tracking
 * 3. Language matching for UI status display
 */
export function useTranslationRouting(
  myLang: string,
  myIdentity: string,
  translationEnabled: boolean = true,
  muteOriginal: boolean = true,
  translateScreenShare: boolean = true,
  translatorMuted: boolean = false,
  speakerMuted: boolean = false,
) {
  const call = useCall();
  const { useRemoteParticipants, useLocalParticipant } = useCallStateHooks();
  const remotes = useRemoteParticipants();
  const localParticipant = useLocalParticipant();

  // Build peer language map from participant custom data
  useEffect(() => {
    if (!call || !localParticipant) return;

    // Update custom data when language changes
    const updateLang = async () => {
      try {
        await call.updateCallMembers({
          update_members: [{
            user_id: localParticipant.userId,
            custom: {
              ...localParticipant.custom,
              lang: myLang,
            },
          }],
        });
      } catch {
        // Non-fatal — custom events will still carry the info
      }
    };

    // Update our own language attribute when it changes
    if (localParticipant) {
      const currentCustom = (localParticipant as StreamVideoParticipant).custom as ParticipantCustomData;
      if (!currentCustom || currentCustom.lang !== myLang) {
        updateLang();
      }
    }
  }, [call, localParticipant, myLang]);

  // Volume control: when speakerMuted changes, adjust all remote participant volumes
  useEffect(() => {
    if (!call) return;
    for (const p of remotes) {
      // Skip agent participants
      if ((p.custom as ParticipantCustomData)?.is_agent) continue;
      // Set volume to 0 if speaker muted, otherwise use the muteOriginal setting
      call.speaker.setParticipantVolume(
        p.sessionId,
        speakerMuted ? 0 : (muteOriginal ? 0.15 : 1.0)
      );
    }
  }, [call, remotes, speakerMuted, muteOriginal]);

  // Note: Translator volume control is handled by the agent participant's audio
  // being published with the appropriate track. The frontend simply subscribes
  // to all audio and uses volume control for the mute toggle.

  return {
    // Expose the peer languages and whether translation is active for each
    peerLangs: computePeerLangs(remotes, myLang),
    localParticipant,
    remotes,
  };
}

function computePeerLangs(
  remotes: StreamVideoParticipant[],
  myLang: string,
): Map<string, { lang: string | undefined; needsTranslation: boolean }> {
  const map = new Map<string, { lang: string | undefined; needsTranslation: boolean }>();
  for (const p of remotes) {
    const custom = p.custom as ParticipantCustomData;
    const lang = typeof custom?.lang === "string" ? custom.lang : undefined;
    const needsTranslation = !!lang && lang !== myLang && myLang !== NATIVE_LANG;
    map.set(p.userId, { lang, needsTranslation });
  }
  return map;
}
