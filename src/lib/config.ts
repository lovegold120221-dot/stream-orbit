/**
 * Shared frontend constants. Mirrors the agent's `translator/src/config.py`
 * where relevant; keep them in sync if you change either.
 */

// Stream Video API key (public, used by client SDK).
export const STREAM_API_KEY =
  process.env.NEXT_PUBLIC_STREAM_API_KEY || "nwq3m66fb9ds";

// Hard cap on participants per room.
export const MAX_PARTICIPANTS = 40;

// Sentinel meaning "no translation, native passthrough."
export const NATIVE_LANG = "none";

// Participant attribute key carrying each participant's chosen language.
// In Stream, this is stored in the user's `custom` object.
export const PARTICIPANT_LANG_ATTR = "lang";

// Call type for Stream Video (matches dashboard configuration).
export const STREAM_CALL_TYPE = "default";

/** Custom data shape stored on each participant via call.updateCallMembers() */
export interface ParticipantCustomData {
  lang?: string;
  orbit_hand?: string;
  orbit_host?: string;
  orbit_glossary?: string;
  orbit_content_type?: string;
  is_agent?: boolean;
}
