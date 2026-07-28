import { generateDurationSuggestions } from "./transportTime.service.js";

export function startTransportSuggestionScheduler() {
  if (process.env.NODE_ENV === "test") return null;
  const intervalMs = Math.max(3600000, Number(process.env.TRANSPORT_SUGGESTION_INTERVAL_MS || 7 * 24 * 3600000));
  const run = () => generateDurationSuggestions({
    lookbackDays: Number(process.env.TRANSPORT_LEARNING_LOOKBACK_DAYS || 90),
    minimumSamples: Number(process.env.TRANSPORT_LEARNING_MINIMUM_SAMPLES || 10)
  }).catch((error) => console.error("[transport-suggestion-scheduler]", error.message));
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
