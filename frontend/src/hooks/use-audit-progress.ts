"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ProgressEvent } from "@/types/audit";

const MAX_SSE_RETRIES = 2;
const SSE_RETRY_DELAY = 2000; // 2 seconds
const POLL_INTERVAL = 2000; // 2 seconds
const STALL_TIMEOUT = 120000; // 2 minutes without events = stalled

export function useAuditProgress(fastApiId: string | null, auditId: string | null) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStalled, setIsStalled] = useState(false);
  const connectionAttemptsRef = useRef(0); // Use ref instead of state to avoid re-renders
  const esRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const stallCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkForStall = useCallback(() => {
    const now = Date.now();
    const timeSinceLastEvent = now - lastEventTimeRef.current;

    // If no event for 2 minutes, consider stalled
    if (timeSinceLastEvent > STALL_TIMEOUT) {
      setIsStalled(true);
      setError("Connection lost - attempting to reconnect...");
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!auditId || isPolling) return;

    console.log('[SSE] Falling back to polling');
    setIsPolling(true);

    const poll = async () => {
      try {
        const res = await fetch(`/api/audit/${auditId}/progress`);
        if (res.ok) {
          const data: ProgressEvent = await res.json();
          setProgress(data);
          setConnected(true);
          setError(null);
          setIsStalled(false);
          lastEventTimeRef.current = Date.now();

          if (data.status === "completed" || data.status === "failed") {
            setDone(true);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } else {
          console.error('[Polling] Failed to fetch progress:', res.status);
          setConnected(false);
          setError(`Polling failed with status ${res.status}`);
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
        setConnected(false);
        setError("Failed to fetch progress");
      }
    };

    // Poll immediately, then every 2 seconds
    poll();
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
  }, [auditId, isPolling]);

  const connect = useCallback(() => {
    if (!fastApiId || isPolling) return;

    // Check retry limit using ref (doesn't trigger re-render)
    if (connectionAttemptsRef.current >= MAX_SSE_RETRIES) {
      console.log('[SSE] Max retries reached, falling back to polling');
      startPolling();
      return;
    }

    const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
    console.log('[SSE] Attempting connection to:', `${fastapiUrl}/api/audit/${fastApiId}/status`);
    const es = new EventSource(`${fastapiUrl}/api/audit/${fastApiId}/status`);
    esRef.current = es;

    es.onopen = () => {
      console.log('[SSE] Connection established');
      setConnected(true);
      setError(null);
      setIsStalled(false);
      connectionAttemptsRef.current = 0; // Reset on successful connection
      lastEventTimeRef.current = Date.now();
    };

    es.addEventListener("progress", (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setProgress(data);
        setError(null);
        setIsStalled(false);
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
      // Keepalive ping - reset stall timer
      lastEventTimeRef.current = Date.now();
    });

    es.onerror = () => {
      connectionAttemptsRef.current += 1;
      console.error('[SSE] Connection error, attempt:', connectionAttemptsRef.current);
      setConnected(false);
      es.close();
      esRef.current = null;

      // Don't call connect() here - let the retry happen via setTimeout
      if (connectionAttemptsRef.current >= MAX_SSE_RETRIES) {
        console.log('[SSE] Max retries reached, falling back to polling');
        setError("Failed to connect via SSE, falling back to polling");
        startPolling();
      } else {
        setError(`Connection failed, retrying... (${connectionAttemptsRef.current}/${MAX_SSE_RETRIES})`);
        // Schedule retry without recursive call
        setTimeout(() => {
          // Only retry if we haven't started polling in the meantime
          if (!isPolling) {
            connect();
          }
        }, SSE_RETRY_DELAY);
      }
    };
  }, [fastApiId, isPolling, startPolling]); // Removed connectionAttempts dependency

  useEffect(() => {
    if (!fastApiId) return;

    // Reset retry counter on new fastApiId
    connectionAttemptsRef.current = 0;
    lastEventTimeRef.current = Date.now();
    setError(null);
    setIsStalled(false);
    connect();

    // Start stall detection (check every 30 seconds)
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
    };
  }, [fastApiId, connect, checkForStall]); // Depend on fastApiId to reset on changes

  return { progress, connected, done, error, isStalled };
}
