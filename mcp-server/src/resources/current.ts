import * as fs from "fs";
import * as path from "path";
import { loadState } from "../state.js";

export const CURRENT_NOTE_URI = "note://current";

export async function getCurrentNoteResource() {
  const state = loadState();

  if (!state?.workspacePath) {
    return {
      uri: CURRENT_NOTE_URI,
      name: "Current Note",
      description: "The note currently open in Chronicle",
      mimeType: "text/plain",
      text: "Error: No workspace open in Chronicle. Open a workspace first.",
    };
  }

  if (!state.currentFile) {
    return {
      uri: CURRENT_NOTE_URI,
      name: "Current Note",
      description: "The note currently open in Chronicle",
      mimeType: "text/plain",
      text: "No note currently open in Chronicle. Open a note first.",
    };
  }

  try {
    const fullPath = path.resolve(state.workspacePath, state.currentFile);
    const content = fs.readFileSync(fullPath, "utf-8");

    return {
      uri: CURRENT_NOTE_URI,
      name: state.currentFile,
      description: `Currently editing: ${state.currentFile}`,
      mimeType: "text/markdown",
      text: content,
    };
  } catch (e) {
    return {
      uri: CURRENT_NOTE_URI,
      name: "Current Note",
      description: "Error reading current note",
      mimeType: "text/plain",
      text: `Error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
