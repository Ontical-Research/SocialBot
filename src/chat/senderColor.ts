const COLORS = [
  "text-red-400",
  "text-blue-400",
  "text-green-400",
  "text-yellow-400",
  "text-purple-400",
  "text-pink-400",
  "text-orange-400",
  "text-cyan-400",
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
