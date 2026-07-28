function stableSerialize(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
}

export function createTimedRequestCache({ staleTime = 120_000, gcTime = 600_000 } = {}) {
  const entries = new Map();

  const prune = (now) => {
    entries.forEach((entry, key) => {
      if (now - entry.updatedAt >= gcTime) entries.delete(key);
    });
  };

  return {
    key(parts) {
      return stableSerialize(parts);
    },

    get(key) {
      const now = Date.now();
      prune(now);
      const entry = entries.get(key);
      return entry && now - entry.updatedAt < staleTime ? entry.value : undefined;
    },

    set(key, value) {
      entries.set(key, { value, updatedAt: Date.now() });
      return value;
    },

    clear() {
      entries.clear();
    }
  };
}

export function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw new DOMException("The request was aborted.", "AbortError");
}
