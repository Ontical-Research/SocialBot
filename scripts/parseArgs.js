/**
 * Parse --name and --topic flags from a list of CLI arguments.
 *
 * @param {string[]} args - Array of CLI argument strings (e.g. process.argv.slice(2))
 * @param {{ name?: string, topic?: string }} [defaults] - Default values
 * @returns {{ name: string, topic: string }}
 */
export function parseArgs(args, defaults = {}) {
  const result = {
    name: defaults.name ?? "User",
    topic: defaults.topic ?? "chat",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && i + 1 < args.length) {
      result.name = args[++i];
    } else if (args[i] === "--topic" && i + 1 < args.length) {
      result.topic = args[++i];
    } else if (args[i].startsWith("--name=")) {
      result.name = args[i].slice("--name=".length);
    } else if (args[i].startsWith("--topic=")) {
      result.topic = args[i].slice("--topic=".length);
    }
  }

  return result;
}
