export const CONFIG_URI = "note://config";

export interface ChronicleConfig {
  markers: {
    thought: string;
    important: string;
    question: string;
    action: string;
    attribution: string;
  };
  processing: {
    default_style: string;
  };
}

export function getDefaultConfig(): ChronicleConfig {
  return {
    markers: {
      thought: ">",
      important: "!",
      question: "?",
      action: "[]",
      attribution: "@",
    },
    processing: {
      default_style: "standard",
    },
  };
}

export function getConfigResource() {
  const config = getDefaultConfig();

  return {
    uri: CONFIG_URI,
    name: "Chronicle Configuration",
    description: "Current marker syntax and processing settings",
    mimeType: "application/json",
    text: JSON.stringify(config, null, 2),
  };
}
