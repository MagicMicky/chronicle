import { getCurrentFile, isConnected } from "../websocket/client.js";

export const CURRENT_NOTE_URI = "note://current";

export async function getCurrentNoteResource() {
  if (!isConnected()) {
    return {
      uri: CURRENT_NOTE_URI,
      name: "Current Note",
      description: "The note currently open in Chronicle",
      mimeType: "text/plain",
      text: "Error: Not connected to Chronicle app. Is it running?",
    };
  }

  try {
    const result = await getCurrentFile();

    if (result.error) {
      return {
        uri: CURRENT_NOTE_URI,
        name: "Current Note",
        description: "The note currently open in Chronicle",
        mimeType: "text/plain",
        text: `Error: ${result.error}`,
      };
    }

    if (!result.path || !result.content) {
      return {
        uri: CURRENT_NOTE_URI,
        name: "Current Note",
        description: "The note currently open in Chronicle",
        mimeType: "text/plain",
        text: "No note currently open in Chronicle. Open a note first.",
      };
    }

    return {
      uri: CURRENT_NOTE_URI,
      name: result.relativePath || "Current Note",
      description: `Currently editing: ${result.relativePath}`,
      mimeType: "text/markdown",
      text: result.content,
    };
  } catch (e) {
    return {
      uri: CURRENT_NOTE_URI,
      name: "Current Note",
      description: "Error fetching current note",
      mimeType: "text/plain",
      text: `Error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
