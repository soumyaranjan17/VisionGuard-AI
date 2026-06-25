import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Custom hook for zero-MB voice recognition using the Deepgram WebSocket API.
 * Identifies speech with its VAD feature and transcripts audio in real-time.
 */
export function useSpeechRecognition() {
  const [isTalking, setIsTalking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Deepgram API details
  const API_KEY = "ad2614e39ec9daff1b7db6c1ef3c82a9789eeb76";

  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const talkingTimeoutRef = useRef(null);

  const stopListening = useCallback(() => {
    // 1. Stop MediaRecorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* no-op */
      }
    }

    // 2. Stop microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // 3. Close Deepgram WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (talkingTimeoutRef.current) {
      clearTimeout(talkingTimeoutRef.current);
    }

    setIsListening(false);
    setIsTalking(false);
  }, []);

  const startListening = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Deepgram WebSocket URL with VAD and endpointing
      const socketUrl =
        "wss://api.deepgram.com/v1/listen?model=nova-2&vad_events=true&endpointing=500&smart_format=true";

      // Pass token via subprotocol header simulation
      const socket = new WebSocket(socketUrl, ["token", API_KEY]);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsListening(true);

        // Once socket is open, start recording and streaming data to it
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0 && socket.readyState === 1) {
            socket.send(event.data);
          }
        });

        // Send an audio packet every 250ms
        mediaRecorder.start(250);
      };

      socket.onmessage = (message) => {
        const received = JSON.parse(message.data);

        // --- 1. SpeechStarted Event ---
        if (received.type === "SpeechStarted") {
          setIsTalking(true);
          if (talkingTimeoutRef.current)
            clearTimeout(talkingTimeoutRef.current);
        }

        // --- 2. UtteranceEnd Event ---
        if (received.type === "UtteranceEnd") {
          // Slight delay to handle cases where speech_final comes closely behind
          talkingTimeoutRef.current = setTimeout(() => {
            setIsTalking(false);
          }, 500);
        }

        // --- 3. Transcripts ---
        if (received.type === "Results") {
          const transcriptObj = received.channel?.alternatives?.[0];
          if (transcriptObj && transcriptObj.transcript.trim().length > 0) {
            setTranscript(transcriptObj.transcript);

            // We also get speech_final to confirm pause
            if (received.is_final && received.speech_final) {
              setIsTalking(false);
            } else {
              // If it's interim, ensure talking flag is set
              setIsTalking(true);
            }
          }
        }
      };

      socket.onclose = () => {
        setIsListening(false);
        setIsTalking(false);
      };

      socket.onerror = (error) => {
        console.error("[Deepgram WebSocket] Error:", error);
      };
    } catch (err) {
      console.error("[SpeechRecognition] Failed to start:", err);
      setIsSupported(false); // Likely microphone access denied
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isTalking,
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
