"use client";

import { useState, useEffect } from "react";

/** WebSocket hook supporting auto-reconnect */
export function useWebSocket(url: string) {
  const [status, setStatus] = useState("disconnected");
  const [msg, setMsg] = useState<any>(null);
  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onmessage = e => setMsg(JSON.parse(e.data));
    return () => ws.close();
  }, [url]);
  return { status, msg };
}