"use client";

import { supabase } from "@/lib/supabase";

/**
 * A single finalized translation entry saved to history.
 */
export interface TranslationHistoryEntry {
  id: string;
  user_id: string;
  room_name: string;
  source_identity: string;
  speaker_name: string;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

const STORAGE_KEY = "orbit.translationHistory";

/** Generate a short readable time label (e.g. "2:30 PM") */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/** Generate a short room label from room name */
function formatRoomName(roomName: string): string {
  // e.g. "room_abc123" → "Room abc123"
  return roomName.replace(/^room[_-]?/i, "Room ");
}

/**
 * Load all saved translation history entries from localStorage.
 */
export function loadHistory(): TranslationHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: TranslationHistoryEntry[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save a batch of new entries to localStorage.
 */
export function saveHistory(entries: TranslationHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadHistory();
    const merged = mergeEntries(existing, entries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error("Failed to save translation history:", e);
  }
}

/**
 * Merge new entries into existing history, deduplicating by id.
 */
function mergeEntries(
  existing: TranslationHistoryEntry[],
  incoming: TranslationHistoryEntry[],
): TranslationHistoryEntry[] {
  const seen = new Set(existing.map((e) => e.id));
  const combined = [...existing];
  for (const entry of incoming) {
    if (!seen.has(entry.id)) {
      combined.push(entry);
      seen.add(entry.id);
    }
  }
  // Sort newest first
  combined.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return combined;
}

/**
 * Try to upload new entries to Supabase.
 * Silently fails if the table doesn't exist or user is offline.
 */
export async function uploadHistoryToSupabase(
  entries: TranslationHistoryEntry[],
): Promise<void> {
  try {
    for (const entry of entries) {
      await supabase.from("translation_history").upsert(entry, {
        onConflict: "id",
      });
    }
  } catch {
    // Table may not exist yet — silently skip
  }
}

/**
 * Try to download history from Supabase for a given user_id.
 * Falls back to localStorage on error.
 */
export async function downloadHistoryFromSupabase(
  userId: string,
): Promise<TranslationHistoryEntry[]> {
  try {
    const { data } = await supabase
      .from("translation_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data && Array.isArray(data)) {
      return data as TranslationHistoryEntry[];
    }
  } catch {
    // Table may not exist
  }
  return [];
}

export { formatTimestamp, formatRoomName };
