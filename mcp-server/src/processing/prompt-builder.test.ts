import { describe, it, expect } from "bun:test";
import { buildPrompt, type ProcessingStyle } from "./prompt-builder";
import type { ParsedMarkers } from "./parser";

function emptyMarkers(): ParsedMarkers {
  return {
    thoughts: [],
    important: [],
    questions: [],
    actions: [],
    attributions: [],
  };
}

function sampleMarkers(): ParsedMarkers {
  return {
    thoughts: ["We should ship faster"],
    important: ["Deadline is Friday"],
    questions: ["What about testing?"],
    actions: ["Write tests"],
    attributions: [{ person: "alice", said: "Looks good" }],
  };
}

describe("buildPrompt", () => {
  it("returns system and user prompt parts", () => {
    const result = buildPrompt("some notes", emptyMarkers(), "standard");
    expect(result).toHaveProperty("system");
    expect(result).toHaveProperty("user");
    expect(typeof result.system).toBe("string");
    expect(typeof result.user).toBe("string");
  });

  it("includes raw notes in user prompt", () => {
    const notes = "Here are my meeting notes about the project";
    const result = buildPrompt(notes, emptyMarkers(), "standard");
    expect(result.user).toContain(notes);
  });

  it("includes marker summary in system prompt", () => {
    const markers = sampleMarkers();
    const result = buildPrompt("notes", markers, "standard");
    expect(result.system).toContain("Thoughts (1)");
    expect(result.system).toContain("Important points (1)");
    expect(result.system).toContain("Questions (1)");
    expect(result.system).toContain("Action items (1)");
    expect(result.system).toContain("alice");
  });

  it("includes marker syntax documentation in system prompt", () => {
    const result = buildPrompt("notes", emptyMarkers(), "standard");
    expect(result.system).toContain("`>` = their thoughts");
    expect(result.system).toContain("`!` = important points");
    expect(result.system).toContain("`?` = questions");
    expect(result.system).toContain("`[]` = action items");
    expect(result.system).toContain("`@name:` = attribution");
  });

  describe("processing styles", () => {
    const styles: ProcessingStyle[] = [
      "standard",
      "brief",
      "detailed",
      "focused",
      "structured",
    ];

    it("standard style adds no extra instructions", () => {
      const result = buildPrompt("notes", emptyMarkers(), "standard");
      expect(result.user).not.toContain("Keep the summary very brief");
      expect(result.user).not.toContain("detailed summary");
      expect(result.user).not.toContain("1:1 meeting");
      expect(result.user).not.toContain("compliance");
    });

    it("brief style adds brevity instructions", () => {
      const result = buildPrompt("notes", emptyMarkers(), "brief");
      expect(result.user).toContain("Keep the summary very brief");
      expect(result.user).toContain("essentials");
    });

    it("detailed style adds detailed instructions", () => {
      const result = buildPrompt("notes", emptyMarkers(), "detailed");
      expect(result.user).toContain("detailed summary");
      expect(result.user).toContain("full context");
    });

    it("focused style adds 1:1 meeting instructions", () => {
      const result = buildPrompt("notes", emptyMarkers(), "focused");
      expect(result.user).toContain("1:1 meeting");
      expect(result.user).toContain("relationship building");
    });

    it("structured style adds compliance/process instructions", () => {
      const result = buildPrompt("notes", emptyMarkers(), "structured");
      expect(result.user).toContain("compliance");
      expect(result.user).toContain("regulatory");
    });

    it("each style produces a unique user prompt", () => {
      const prompts = styles.map(
        (style) => buildPrompt("same notes", emptyMarkers(), style).user
      );
      const uniquePrompts = new Set(prompts);
      expect(uniquePrompts.size).toBe(styles.length);
    });
  });

  describe("focus parameter", () => {
    it("includes focus when provided", () => {
      const result = buildPrompt(
        "notes",
        emptyMarkers(),
        "standard",
        undefined,
        "budget implications"
      );
      expect(result.user).toContain("Focus especially on: budget implications");
    });

    it("does not include focus section when not provided", () => {
      const result = buildPrompt("notes", emptyMarkers(), "standard");
      expect(result.user).not.toContain("Focus especially on");
    });

    it("combines style and focus", () => {
      const result = buildPrompt(
        "notes",
        emptyMarkers(),
        "brief",
        undefined,
        "action items"
      );
      expect(result.user).toContain("Keep the summary very brief");
      expect(result.user).toContain("Focus especially on: action items");
    });
  });

  describe("duration parameter", () => {
    it("includes duration when provided", () => {
      const result = buildPrompt("notes", emptyMarkers(), "standard", 45);
      expect(result.user).toContain("duration: 45 minutes");
    });

    it("does not include duration when not provided", () => {
      const result = buildPrompt("notes", emptyMarkers(), "standard");
      expect(result.user).not.toContain("duration");
    });
  });

  describe("empty markers", () => {
    it("produces valid prompt with empty markers", () => {
      const result = buildPrompt("notes", emptyMarkers(), "standard");
      expect(result.system).toContain(
        "No semantic markers found in notes."
      );
      expect(result.user.length).toBeGreaterThan(0);
      expect(result.system.length).toBeGreaterThan(0);
    });
  });

  describe("output format requirements", () => {
    it("system prompt specifies expected sections", () => {
      const result = buildPrompt("notes", emptyMarkers(), "standard");
      expect(result.system).toContain("TL;DR");
      expect(result.system).toContain("Key Points");
      expect(result.system).toContain("Action Items");
      expect(result.system).toContain("Open Questions");
      expect(result.system).toContain("Raw Notes");
    });
  });
});
