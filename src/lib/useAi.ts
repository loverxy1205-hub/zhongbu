import { useEffect, useRef, useState } from "react";
import type { AiEnhancement, EngineId, SavedReading } from "../types";
import type { AiStatus } from "../components/AiPanel";
import { buildAiRequest, requestAi } from "./ai";

export function useAi(active: SavedReading | null) {
  const controllers = useRef(new Map<string, AbortController>());
  const [statuses, setStatuses] = useState<Record<string, AiStatus>>({});
  const id = active?.reading.readingId;
  useEffect(
    () => () => {
      for (const controller of controllers.current.values()) controller.abort();
      controllers.current.clear();
    },
    [id],
  );
  async function generate(
    engine: EngineId,
    includeContext: boolean,
    onComplete: (
      readingId: string,
      engine: EngineId,
      value: AiEnhancement,
    ) => void,
  ) {
    if (!active || active.enhancements?.[engine]) return;
    const readingId = active.reading.readingId;
    const key = `${readingId}:${engine}`;
    if (controllers.current.has(key)) return;
    const controller = new AbortController();
    controllers.current.set(key, controller);
    setStatuses((old) => ({ ...old, [key]: { busy: true } }));
    try {
      const request = buildAiRequest(active.reading, engine, includeContext);
      const response = await requestAi(request, controller.signal);
      if (!controller.signal.aborted)
        onComplete(readingId, engine, {
          request,
          response,
          contextIncluded: includeContext,
        });
      setStatuses((old) => ({ ...old, [key]: { busy: false } }));
    } catch (error) {
      setStatuses((old) => ({
        ...old,
        [key]: {
          busy: false,
          error: error instanceof Error ? error.message : "暂时未能生成解读。",
        },
      }));
    } finally {
      if (controllers.current.get(key) === controller)
        controllers.current.delete(key);
    }
  }
  return { statuses, generate };
}
