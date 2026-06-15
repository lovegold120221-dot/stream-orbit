"""Constants for the translation agent."""

from __future__ import annotations

# --- Gemini Live ---

GEMINI_MODEL = "gemini-3.5-live-translate-preview"

# Gemini Live API audio formats.
GEMINI_INPUT_SAMPLE_RATE = 16000  # Gemini expects 16kHz mono PCM in
GEMINI_OUTPUT_SAMPLE_RATE = 24000  # Gemini emits 24kHz mono PCM out
AUDIO_CHANNELS = 1

# --- LiveKit ---

# Track attribute keys for translator-published tracks.
TRACK_ATTR_KIND = "kind"
TRACK_ATTR_SOURCE_IDENTITY = "source_identity"
TRACK_ATTR_TARGET_LANG = "target_lang"

# Marker value for the `kind` attribute on translator tracks.
TRANSLATION_TRACK_KIND = "translation"

# --- Translation Memory ---

# Max transcript entries kept in rolling context for session memory.
MAX_TRANSCRIPT_HISTORY = 30
# Max words across all history entries before oldest are dropped.
MAX_HISTORY_WORDS = 600

# Participant attribute carrying each participant's chosen language.
PARTICIPANT_LANG_ATTR = "lang"

# Participant attribute key for glossary (JSON array of {source, translation}).
GLOSSARY_ATTR = "orbit_glossary"

# Sentinel meaning "no translation, native passthrough."
NATIVE_LANG = "none"

# --- Router behavior ---

# Debounce window for room state changes before reconciling sessions.
RECONCILE_DEBOUNCE_SEC = 0.25

# How long to keep a session warm after its last demand disappears
# (speaker mutes, or the last listener for a target language leaves).
SESSION_GRACE_SEC = 10.0

# --- Gemini connection ---

# Exponential backoff schedule for reconnecting a failed Gemini session.
GEMINI_RECONNECT_BACKOFF_SEC = [0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 30.0]
GEMINI_MAX_FAILURES_BEFORE_LONG_BACKOFF = 5
