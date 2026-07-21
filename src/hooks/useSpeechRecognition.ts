"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionType;
    webkitSpeechRecognition?: new () => SpeechRecognitionType;
  }
}

export function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function useSpeechRecognition(onResult: (result: SpeechResult) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const shouldRestart = useRef(false);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    setSupported(isSpeechSupported());
  }, []);

  const stop = useCallback(() => {
    shouldRestart.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    if (!isSpeechSupported()) {
      setError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    setError(null);
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    // Recreate each start for reliability
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += text;
        } else {
          interim += text;
        }
      }

      if (finalChunk) {
        onResultRef.current({ transcript: finalChunk.trim(), isFinal: true });
      }
      if (interim) {
        onResultRef.current({ transcript: interim.trim(), isFinal: false });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setError("Microphone permission denied. Allow mic access to transcribe.");
        shouldRestart.current = false;
        setListening(false);
        return;
      }
      setError(`Speech error: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldRestart.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          shouldRestart.current = false;
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    shouldRestart.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Could not start speech recognition.");
      setListening(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      shouldRestart.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { listening, supported, error, start, stop, setError };
}
