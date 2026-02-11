"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ProgressEvent } from "@/types/audit";

export function useAuditProgress(fastApiId: string | null) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!fastApiId) return;

    const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
    const es = new EventSource(`${fastapiUrl}/api/audit/${fastApiId}/status`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener("progress", (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setProgress(data);

        if (data.status === "completed" || data.status === "failed") {
          setDone(true);
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
    };
  }, [fastApiId]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  return { progress, connected, done };
}
