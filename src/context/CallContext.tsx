"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  StreamVideo,
  StreamCall,
  StreamVideoClient,
  User,
  Call,
} from "@stream-io/video-react-sdk";
import { STREAM_API_KEY } from "@/lib/config";
import PersistentCallBar from "@/components/PersistentCallBar";

export interface ActiveCallState {
  token: string;
  sessionId: string;
  initialLang: string;
}

interface CallContextValue {
  activeCall: ActiveCallState | null;
  setActiveCall: (call: ActiveCallState | null) => void;
  leaveCall: () => void;
  streamClient: StreamVideoClient | null;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  const leaveCall = useCallback(() => {
    if (call) {
      call.leave().catch(() => {});
    }
    setCall(null);
    setClient(null);
    setActiveCall(null);
    router.push("/");
  }, [call, router]);

  // Create Stream client when activeCall changes
  useEffect(() => {
    if (!activeCall) {
      // Cleanup old client on disconnection
      if (client) {
        client.disconnectUser().catch(() => {});
      }
      setClient(null);
      setCall(null);
      return;
    }

    const user: User = {
      id: `peer-${crypto.randomUUID().slice(0, 8)}`,
      name: "Participant",
    };

    const tokenProvider = async () => activeCall.token;

    const streamClient = new StreamVideoClient({
      apiKey: STREAM_API_KEY,
      user,
      token: activeCall.token,
      tokenProvider,
    });

    setClient(streamClient);

    // Create the call
    const streamCall = streamClient.call("default", activeCall.sessionId);
    setCall(streamCall);

    return () => {
      streamClient.disconnectUser().catch(() => {});
    };
  }, [activeCall?.token, activeCall?.sessionId]);

  // When we have both client and call, join the call
  useEffect(() => {
    if (!call || !client) return;

    call.join({ create: true }).catch((err) => {
      console.error("[CallContext] Failed to join call:", err);
    });

    return () => {
      call.leave().catch(() => {});
    };
  }, [call, client]);

  if (activeCall && client && call) {
    return (
      <CallContext.Provider value={{ activeCall, setActiveCall, leaveCall, streamClient: client }}>
        <StreamVideo client={client}>
          <StreamCall call={call}>
            {children}
            <PersistentCallBar sessionId={activeCall.sessionId} onLeave={leaveCall} />
          </StreamCall>
        </StreamVideo>
      </CallContext.Provider>
    );
  }

  return (
    <CallContext.Provider value={{ activeCall, setActiveCall, leaveCall, streamClient: null }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCallContext() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error("useCallContext must be used within a CallProvider");
  }
  return context;
}
