import type { ExcalidrawSceneFile } from '../types';

export const IBSIDIAN_EXCALIDRAW_SOURCE = 'https://ibsidian.app/excalidraw';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

export const createEmptyExcalidrawScene = (): ExcalidrawSceneFile => ({
  type: 'excalidraw',
  version: 2,
  source: IBSIDIAN_EXCALIDRAW_SOURCE,
  elements: [],
  appState: {
    viewBackgroundColor: '#ffffff',
  },
  files: {},
});

export const createEmptyExcalidrawFileContent = (): string => {
  return JSON.stringify(createEmptyExcalidrawScene(), null, 2);
};

export const parseExcalidrawFileContent = (content: string): { scene: ExcalidrawSceneFile; wasRecovered: boolean } => {
  if (!content.trim()) {
    return { scene: createEmptyExcalidrawScene(), wasRecovered: false };
  }

  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || ('elements' in parsed && !Array.isArray(parsed.elements))) {
      return { scene: createEmptyExcalidrawScene(), wasRecovered: true };
    }

    return {
      scene: {
        type: typeof parsed.type === 'string' ? parsed.type : 'excalidraw',
        version: typeof parsed.version === 'number' ? parsed.version : 2,
        source: typeof parsed.source === 'string' ? parsed.source : IBSIDIAN_EXCALIDRAW_SOURCE,
        elements: Array.isArray(parsed.elements) ? parsed.elements : [],
        appState: isRecord(parsed.appState) ? parsed.appState : undefined,
        files: isRecord(parsed.files) ? parsed.files : {},
      },
      wasRecovered: false,
    };
  } catch {
    return { scene: createEmptyExcalidrawScene(), wasRecovered: true };
  }
};
