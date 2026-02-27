import { useState, useEffect } from "react";

/**
 * Returns the list of available models: always starts with ``"None"``, followed by
 * models reported by the server's ``/api/models`` endpoint, then any models from
 * history that are not already in the list.
 *
 * :param modelHistory: Previously used model strings from settings history.
 */
export function useAvailableModels(modelHistory: string[]): string[] {
  const [serverModels, setServerModels] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d: { models?: string[] }) => setServerModels(d.models ?? []))
      .catch(() => {});
  }, []);

  const merged = ["None", ...serverModels];
  for (const m of modelHistory) {
    if (!merged.includes(m)) merged.push(m);
  }
  return merged;
}
