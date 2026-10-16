"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Plays one preview clip at a time. `play(key, load)` toggles: calling it again with the
 * key that is playing stops it. Blobs for `cacheable` keys are kept for the session.
 */
export function useAudioPreview() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCache = useRef(new Map<string, string>());
  const tempUrl = useRef<string | null>(null);
  const requestId = useRef(0);

  const stop = useCallback(() => {
    requestId.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (tempUrl.current) {
      URL.revokeObjectURL(tempUrl.current);
      tempUrl.current = null;
    }
    setPlayingKey(null);
    setLoadingKey(null);
  }, []);

  const play = useCallback(
    async (key: string, load: () => Promise<Blob>, { cacheable = false } = {}) => {
      const wasPlaying = playingKey === key || loadingKey === key;
      stop();
      if (wasPlaying) return;

      const id = requestId.current;
      let url = cacheable ? urlCache.current.get(key) : undefined;
      if (!url) {
        setLoadingKey(key);
        let blob: Blob;
        try {
          blob = await load();
        } catch (error) {
          if (id === requestId.current) setLoadingKey(null);
          throw error; // the caller shows the message
        }
        if (id !== requestId.current) return; // superseded by another click
        url = URL.createObjectURL(blob);
        if (cacheable) urlCache.current.set(key, url);
        else tempUrl.current = url;
        setLoadingKey(null);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) stop();
      };
      setPlayingKey(key);
      await audio.play();
    },
    [loadingKey, playingKey, stop],
  );

  useEffect(() => {
    const cache = urlCache.current;
    return () => {
      audioRef.current?.pause();
      if (tempUrl.current) URL.revokeObjectURL(tempUrl.current);
      cache.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  return { play, stop, loadingKey, playingKey };
}
