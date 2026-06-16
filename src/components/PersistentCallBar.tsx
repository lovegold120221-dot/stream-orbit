"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCall,
  useCallStateHooks,
  hasScreenShare,
} from "@stream-io/video-react-sdk";

export default function PersistentCallBar({ 
  sessionId, 
  onLeave 
}: { 
  sessionId: string; 
  onLeave: () => void 
}) {
  const pathname = usePathname();
  const router = useRouter();
  const call = useCall();
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();

  // Hide the floating bar if we are actively viewing the room page
  if (pathname === `/session/${sessionId}/room`) {
    return null;
  }

  const isScreenSharing = localParticipant ? hasScreenShare(localParticipant) : false;

  return (
    <div className="persistent-call-bar">
      <div className="persistent-call-bar-content">
        <div className="persistent-call-status">
          <div className="pulse-dot"></div>
          <span>Call in progress ({sessionId})</span>
        </div>
        
        <div className="persistent-call-actions">
          <button 
            className="btn btn-dark" 
            onClick={() => router.push(`/session/${sessionId}/room`)}
          >
            Return to Room
          </button>
          
          {isScreenSharing && call && (
            <button 
              className="btn btn-outline" 
              onClick={() => call.screenShare.disable().catch(() => {})}
            >
              Stop Screen Share
            </button>
          )}
          
          <button 
            className="btn persistent-call-leave" 
            onClick={async () => {
              if (call) await call.leave().catch(() => {});
              onLeave();
            }}
          >
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}
