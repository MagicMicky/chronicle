export interface ParsedMarkers {
  thoughts: string[];
  important: string[];
  questions: string[];
  actions: string[];
  attributions: { person: string; said: string }[];
}

/**
 * Parse semantic markers from note content
 *
 * Markers:
 * - `>` = thoughts/things to say
 * - `!` = important points from others
 * - `?` = questions/unclear items
 * - `[]` = action items
 * - `@name:` = attribution
 */
export function parseMarkers(content: string): ParsedMarkers {
  const lines = content.split("\n");
  const result: ParsedMarkers = {
    thoughts: [],
    important: [],
    questions: [],
    actions: [],
    attributions: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("> ")) {
      result.thoughts.push(trimmed.slice(2));
    } else if (trimmed.startsWith("! ")) {
      result.important.push(trimmed.slice(2));
    } else if (trimmed.startsWith("? ")) {
      result.questions.push(trimmed.slice(2));
    } else if (trimmed.startsWith("[] ")) {
      result.actions.push(trimmed.slice(3));
    } else if (trimmed.startsWith("[x] ") || trimmed.startsWith("[X] ")) {
      // Completed action items - still capture them
      result.actions.push(`[DONE] ${trimmed.slice(4)}`);
    } else if (trimmed.startsWith("@")) {
      const match = trimmed.match(/^@(\w+):\s*(.+)$/);
      if (match) {
        result.attributions.push({ person: match[1], said: match[2] });
      }
    }
  }

  return result;
}

/**
 * Format parsed markers as a summary string for the prompt
 */
export function formatMarkerSummary(markers: ParsedMarkers): string {
  const parts: string[] = [];

  if (markers.thoughts.length > 0) {
    parts.push(`Thoughts (${markers.thoughts.length}): User's internal thoughts and things to say`);
  }
  if (markers.important.length > 0) {
    parts.push(`Important points (${markers.important.length}): Key items flagged by user`);
  }
  if (markers.questions.length > 0) {
    parts.push(`Questions (${markers.questions.length}): Items needing clarification`);
  }
  if (markers.actions.length > 0) {
    parts.push(`Action items (${markers.actions.length}): Tasks identified during note-taking`);
  }
  if (markers.attributions.length > 0) {
    const people = [...new Set(markers.attributions.map((a) => a.person))];
    parts.push(`Attributions: Statements from ${people.join(", ")}`);
  }

  return parts.length > 0 ? parts.join("\n") : "No semantic markers found in notes.";
}
