"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { ProgressEvent } from "@/types/audit";
import type { ActivityEntry } from "@/components/audit/audit-progress";

const MAX_SSE_RETRIES = 2;
const SSE_RETRY_DELAY = 2000; // 2 seconds
const POLL_INTERVAL = 2000; // 2 seconds
const STALL_TIMEOUT = 120000; // 2 minutes without events = stalled
const MAX_ACTIVITY_ENTRIES = 500;

function formatUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function useAuditProgress(fastApiId: string | null, auditId: string | null) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const connectionAttemptsRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const stallCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectingToastRef = useRef<string | number | null>(null);

  // Activity tracking refs (deduplication)
  const lastUrlRef = useRef<string | null>(null);
  const lastStageRef = useRef<string | null>(null);
  const lastAnalyzerRef = useRef<string | null>(null);
  const lastAnalyzerCompleteRef = useRef<string | null>(null);
  const entryIdRef = useRef(0);

  const addActivityEntry = useCallback((type: ActivityEntry["type"], label: string) => {
    const entry: ActivityEntry = {
      id: String(++entryIdRef.current),
      type,
      label,
    };
    setActivityLog((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_ACTIVITY_ENTRIES ? next.slice(-MAX_ACTIVITY_ENTRIES) : next;
    });
  }, []);

  const trackProgress = useCallback((data: ProgressEvent) => {
    // Track URL changes
    if (data.current_url && data.current_url !== lastUrlRef.current) {
      lastUrlRef.current = data.current_url;
      addActivityEntry("url", formatUrlPath(data.current_url));
    }

    // Track stage changes
    if (data.stage && data.stage !== lastStageRef.current) {
      lastStageRef.current = data.stage;
      const stageLabels: Record<string, string> = {
        crawling: "Crawling",
        analyzing: "Analyzing",
        generating_report: "Generating Report",
        report: "Generating Report",
      };
      addActivityEntry("stage", stageLabels[data.stage] || data.stage);
    }

    // Track analyzer starts
    if (
      data.analyzer_name &&
      data.analyzer_phase === "running" &&
      data.analyzer_name !== lastAnalyzerRef.current
    ) {
      lastAnalyzerRef.current = data.analyzer_name;
      addActivityEntry("analyzer", data.analyzer_name);
    }

    // Track analyzer completions
    if (
      data.analyzer_name &&
      data.analyzer_phase === "completed" &&
      `completed-${data.analyzer_name}` !== lastAnalyzerCompleteRef.current
    ) {
      lastAnalyzerCompleteRef.current = `completed-${data.analyzer_name}`;
      addActivityEntry("analyzer_done", `✓ ${data.analyzer_name}`);
    }
  }, [addActivityEntry]);

  const dismissConnectingToast = useCallback(() => {
    if (connectingToastRef.current !== null) {
      toast.dismiss(connectingToastRef.current);
      connectingToastRef.current = null;
    }
  }, []);

  const checkForStall = useCallback(() => {
    const now = Date.now();
    const timeSinceLastEvent = now - lastEventTimeRef.current;

    if (timeSinceLastEvent > STALL_TIMEOUT) {
      dismissConnectingToast();
      toast.error("Connection lost. The audit may still be running in the background.");
    }
  }, [dismissConnectingToast]);

  const startPolling = useCallback(() => {
    if (!auditId || isPolling) return;

    setIsPolling(true);

    const poll = async () => {
      try {
        const res = await fetch(`/api/audit/${auditId}/progress`);
        if (res.ok) {
          const data: ProgressEvent = await res.json();
          trackProgress(data);
          setProgress((prev) => {
          if (
            prev &&
            prev.progress === data.progress &&
            prev.status === data.status &&
            prev.current_url === data.current_url &&
            prev.pages_crawled === data.pages_crawled &&
            prev.analyzer_name === data.analyzer_name &&
            prev.analyzers_completed === data.analyzers_completed
          ) {
            return prev;
          }
          return data;
        });
          setConnected(true);
          dismissConnectingToast();
          lastEventTimeRef.current = Date.now();

          if (data.status === "completed" || data.status === "failed") {
            setDone(true);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } else {
          setConnected(false);
          toast.error(`Polling failed with status ${res.status}`);
        }
      } catch {
        setConnected(false);
        toast.error("Failed to fetch progress");
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
  }, [auditId, isPolling, dismissConnectingToast, trackProgress]);

  const connectRef = useRef<() => void>(null);

  const connect = useCallback(() => {
    if (!fastApiId || isPolling) return;

    if (connectionAttemptsRef.current >= MAX_SSE_RETRIES) {
      dismissConnectingToast();
      startPolling();
      return;
    }

    const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
    const es = new EventSource(`${fastapiUrl}/api/audit/${fastApiId}/status`);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      dismissConnectingToast();
      connectionAttemptsRef.current = 0;
      lastEventTimeRef.current = Date.now();
    };

    es.addEventListener("progress", (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        trackProgress(data);
        setProgress((prev) => {
          if (
            prev &&
            prev.progress === data.progress &&
            prev.status === data.status &&
            prev.current_url === data.current_url &&
            prev.pages_crawled === data.pages_crawled &&
            prev.analyzer_name === data.analyzer_name &&
            prev.analyzers_completed === data.analyzers_completed
          ) {
            return prev;
          }
          return data;
        });
        dismissConnectingToast();
        lastEventTimeRef.current = Date.now();

        if (data.status === "completed" || data.status === "failed") {
          setDone(true);
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("ping", () => {
      lastEventTimeRef.current = Date.now();
    });

    es.onerror = () => {
      connectionAttemptsRef.current += 1;
      setConnected(false);
      es.close();
      esRef.current = null;

      if (connectionAttemptsRef.current >= MAX_SSE_RETRIES) {
        dismissConnectingToast();
        startPolling();
      } else {
        connectingToastRef.current = toast.loading(
          `Connecting... (${connectionAttemptsRef.current}/${MAX_SSE_RETRIES})`
        );
        setTimeout(() => {
          if (!isPolling) {
            connectRef.current?.();
          }
        }, SSE_RETRY_DELAY);
      }
    };
  }, [fastApiId, isPolling, startPolling, dismissConnectingToast, trackProgress]);

  useEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    if (!fastApiId) return;

    connectionAttemptsRef.current = 0;
    lastEventTimeRef.current = Date.now();
    dismissConnectingToast();
    connect(); // eslint-disable-line react-hooks/set-state-in-effect -- connect initiates SSE subscription

    stallCheckIntervalRef.current = setInterval(checkForStall, 30000);

    return () => {
      esRef.current?.close();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (stallCheckIntervalRef.current) {
        clearInterval(stallCheckIntervalRef.current);
        stallCheckIntervalRef.current = null;
      }
      dismissConnectingToast();
    };
  }, [fastApiId, connect, checkForStall, dismissConnectingToast]);

  return { progress, connected, done, isPolling, activityLog };
}
