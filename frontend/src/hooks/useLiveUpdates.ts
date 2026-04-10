import { useEffect, useState } from "react";
import { getAnalyticsStreamUrl } from "../api/client";

export function useLiveUpdates(enabled = true) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setStreamConnected(false);
      return () => undefined;
    }

    const eventSource = new EventSource(getAnalyticsStreamUrl());

    eventSource.onopen = () => {
      setStreamConnected(true);
    };

    eventSource.onmessage = () => {
      setRefreshTick((prev) => prev + 1);
    };

    eventSource.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      eventSource.close();
      setStreamConnected(false);
    };
  }, [enabled]);

  return {
    refreshTick,
    streamConnected,
  };
}
