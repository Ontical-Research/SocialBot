const COLORS = [
  "text-rose-500 dark:text-rose-400",
  "text-sky-500 dark:text-sky-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-amber-600 dark:text-amber-400",
  "text-fuchsia-600 dark:text-fuchsia-400",
  "text-pink-500 dark:text-pink-400",
  "text-orange-500 dark:text-orange-400",
  "text-teal-600 dark:text-teal-400",
];

/**
 * Returns a deterministic Tailwind color class for a sender name.
 * Uses a djb2 hash so the same name always maps to the same color.
 *
 * :param name: The sender's display name.
 * :returns:    A Tailwind text color class string.
 */
export function senderColor(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export { COLORS };
