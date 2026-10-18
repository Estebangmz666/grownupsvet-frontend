import { useCallback, useEffect, useState } from "react";
import * as Speech from "expo-speech";

export interface UseReadAloudOptions {
  language?: string;
}

export interface UseReadAloudResult {
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

export function useReadAloud(
  options: UseReadAloudOptions = {},
): UseReadAloudResult {
  const { language = "es" } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      Speech.stop();
      setIsSpeaking(true);
      Speech.speak(text, {
        language,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [language],
  );

  const stop = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
}
