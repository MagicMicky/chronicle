import type { ParsedMarkers } from "./parser.js";
import { formatMarkerSummary } from "./parser.js";

export type ProcessingStyle =
  | "standard"
  | "brief"
  | "detailed"
  | "focused"
  | "structured";

export interface PromptParts {
  system: string;
  user: string;
}

/**
 * Build the Claude API prompt for processing notes
 */
export function buildPrompt(
  rawNotes: string,
  parsedMarkers: ParsedMarkers,
  style: ProcessingStyle,
  durationMinutes?: number,
  focus?: string
): PromptParts {
  const system = `You are processing meeting notes for a busy professional. Transform raw notes into a structured, actionable summary.

## Marker Syntax
The notes use semantic markers that the user added during capture:
- \`>\` = their thoughts/things to say
- \`!\` = important points from others
- \`?\` = questions/unclear items
- \`[]\` = action items
- \`@name:\` = attribution (who said what)

## Markers Found
${formatMarkerSummary(parsedMarkers)}

## Output Format
Transform the notes into markdown with these sections:

1. **TL;DR** (2-3 sentences) - main topic and key takeaway
2. **Key Points** - important items discussed, grouped thematically
3. **Action Items** - as checklist with owner if identifiable, priority if clear
4. **Open Questions** - items needing follow-up
5. **Raw Notes** - preserve original content at the end under a collapsible section

## Source Attribution
For each key point, action item, and question, include the source line number(s) from the original note where the information was found. Use "sourceLines" (array of line numbers) for key points, and "sourceLine" (single number) for actions and questions. Line numbers are 1-based.

When outputting JSON, use this schema:
{
  "tldr": "2-3 sentence summary",
  "keyPoints": [
    { "text": "point text", "sourceLines": [12, 15] }
  ],
  "actionItems": [
    { "text": "...", "owner": "...", "done": false, "sourceLine": 8 }
  ],
  "questions": [
    { "text": "question text", "sourceLine": 23 }
  ],
  "tags": ["tag1", "tag2"],
  "processedAt": "ISO timestamp"
}

Be concise. Prioritize actionability. Preserve the user's voice and key details.`;

  let userPrompt = `Process these notes`;
  if (durationMinutes) {
    userPrompt += ` (duration: ${durationMinutes} minutes)`;
  }
  userPrompt += `:\n\n${rawNotes}`;

  // Add style-specific instructions
  switch (style) {
    case "brief":
      userPrompt +=
        "\n\nKeep the summary very brief - just the essentials. TL;DR and action items are most important.";
      break;
    case "detailed":
      userPrompt +=
        "\n\nProvide a detailed summary with full context. Include all nuances and supporting details.";
      break;
    case "focused":
      userPrompt +=
        "\n\nThis is a 1:1 meeting - focus on relationship building, career development, feedback, and personal topics. Capture the human elements.";
      break;
    case "structured":
      userPrompt +=
        "\n\nThis is about structured processes (compliance, audit, regulatory). Focus on evidence gaps, timelines, regulatory requirements, and remediation items.";
      break;
    default:
      // standard - no additional instructions
      break;
  }

  if (focus) {
    userPrompt += `\n\nFocus especially on: ${focus}`;
  }

  return { system, user: userPrompt };
}
