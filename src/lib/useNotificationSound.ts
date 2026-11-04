"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 通知音。ブラウザは画面を一度タップするまで音を鳴らせないので、
 * enabled が false のあいだは画面のタップを待ち、タップされたら試しに一度鳴らして確かめる。
 */
export function useNotificationSound(src: string, playbackRate = 1) {
  const [enabled, setEnabled] = useState(false);
  const soundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const sound = new Audio(src);
    // 読み込み時に playbackRate は defaultPlaybackRate に戻るので両方に入れる
    sound.defaultPlaybackRate = playbackRate;
    sound.playbackRate = playbackRate;
    soundRef.current = sound;
  }, [src, playbackRate]);

  const play = useCallback(() => {
    const sound = soundRef.current;
    if (!sound) return Promise.resolve(false);
    sound.currentTime = 0;
    sound.playbackRate = playbackRate;
    return sound.play().then(
      () => true,
      () => {
        setEnabled(false);
        return false;
      }
    );
  }, [playbackRate]);

  useEffect(() => {
    if (enabled) return;
    const unlock = () => {
      play().then((ok) => ok && setEnabled(true));
    };
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, [enabled, play]);

  return { enabled, play };
}

/**
 * 一覧が更新されるたびに id を渡すと、前回なかった id を返す。
 * 最初の 1 回は今ある分を覚えるだけで、何も返さない（読み込み時に鳴らさないため）。
 */
export function useNewIds() {
  const knownRef = useRef<Set<string> | null>(null);
  return useCallback((ids: string[]) => {
    const known = knownRef.current;
    knownRef.current = new Set(ids);
    return known === null ? [] : ids.filter((id) => !known.has(id));
  }, []);
}
