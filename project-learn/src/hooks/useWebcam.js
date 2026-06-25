import { useRef, useState, useCallback, useEffect } from 'react';
import { WEBCAM_CONFIG } from '../utils/constants';

/**
 * Custom hook for managing webcam access, stream lifecycle, and cleanup.
 * Returns a ref to attach to a <video> element, stream status, and controls.
 */
export function useWebcam() {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState(null);

    const startWebcam = useCallback(async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: WEBCAM_CONFIG.width },
                    height: { ideal: WEBCAM_CONFIG.height },
                    facingMode: WEBCAM_CONFIG.facingMode,
                    frameRate: WEBCAM_CONFIG.frameRate,
                },
                audio: false, // Audio handled separately by SpeechRecognition
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            setIsActive(true);
        } catch (err) {
            console.error('[useWebcam] Failed to access camera:', err);
            setError(err.message || 'Camera access denied');
            setIsActive(false);
        }
    }, []);

    const stopWebcam = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsActive(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, [stopWebcam]);

    return {
        videoRef,
        isActive,
        error,
        startWebcam,
        stopWebcam,
    };
}
