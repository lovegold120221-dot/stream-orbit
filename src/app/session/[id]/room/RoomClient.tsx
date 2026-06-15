"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCallContext } from "@/context/CallContext";
import InCall from "./InCall";

const STORAGE_KEY_NAME = "lt.displayName";
const STORAGE_KEY_LANG = "lt.lang";

function getSessionItem(key: string) {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
}

interface TokenResponse {
  token: string;
  serverUrl: string;
}

export default function RoomClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { activeCall, setActiveCall, leaveCall } = useCallContext();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // For breakout rooms: use the pre-generated identity from the breakout API.
  // Read synchronously during render (not in useEffect) so useState can use it.
  const breakoutIdentity =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("orbit.breakout-identity")
      : null;

  const [identity] = useState(() => {
    // Breakout rooms use the identity from the pre-generated token.
    if (breakoutIdentity) return breakoutIdentity;
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? `peer-${crypto.randomUUID().slice(0, 8)}`
      : `peer-${Math.random().toString(36).slice(2, 10)}`;
  });
  const [displayName] = useState<string>(
    () => getSessionItem(STORAGE_KEY_NAME) ?? "",
  );
  const [initialLang] = useState<string>(
    () => getSessionItem(STORAGE_KEY_LANG) ?? "en",
  );

  // Pull name + lang chosen in the pre-flight screen. If missing, send the
  // user back to the pre-flight so they can pick.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const name = window.sessionStorage.getItem(STORAGE_KEY_NAME);
    const lang = window.sessionStorage.getItem(STORAGE_KEY_LANG);
    if (!name || !lang) {
      router.replace(`/session/${sessionId}`);
    }
  }, [router, sessionId]);

  // Mint a LiveKit token. For breakout rooms, use pre-generated token if available.
  useEffect(() => {
    if (!displayName) return;

    // Check if this is a breakout room with a pre-generated token
    const breakoutToken = typeof window !== 'undefined' ? window.sessionStorage.getItem("orbit.breakout-token") : null;
    const breakoutUrl = typeof window !== 'undefined' ? window.sessionStorage.getItem("orbit.breakout-server-url") : null;

    if (breakoutToken && breakoutUrl) {
      setToken(breakoutToken);
      setServerUrl(breakoutUrl);
      // Clean up so reconnects use normal flow
      window.sessionStorage.removeItem("orbit.breakout-token");
      window.sessionStorage.removeItem("orbit.breakout-server-url");
      return;
    }

    const isHost = typeof window !== 'undefined' && window.sessionStorage.getItem("orbitHostRoom") === sessionId;
    
    // If we are already connected to this session, reuse the context
    if (activeCall && activeCall.sessionId === sessionId) {
      setToken(activeCall.token);
      setServerUrl(activeCall.serverUrl);
      return;
    }

    const url = `/api/token?room=${encodeURIComponent(
      sessionId,
    )}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(displayName)}${isHost ? '&host=true' : ''}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Token request failed (${res.status})`);
        }
        return res.json() as Promise<TokenResponse>;
      })
      .then((data) => {
        setToken(data.token);
        setServerUrl(data.serverUrl);
        setActiveCall({
          token: data.token,
          serverUrl: data.serverUrl,
          sessionId,
          initialLang
        });
      })
      .catch((err) => setError(err.message));
  }, [sessionId, identity, displayName, activeCall, initialLang, setActiveCall]);

  function handleLeave() {
    leaveCall();
  }

  if (error) {
    return (
      <div className="page text-center">
        <div className="container">
          <h1 className="display display-md mb-16">
            Couldn&apos;t join the call
          </h1>
          <p className="body mb-24">
            {error}
          </p>
          <button className="btn btn-outline" onClick={() => router.push("/")}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="page text-center">
        <div className="container">
          <div className="spinner mx-auto mb-16" />
          <p className="mono">Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-100vh bg-bg">
      <InCall initialLang={initialLang} onLeave={handleLeave} />
    </div>
  );
}
