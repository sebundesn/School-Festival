"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

// ブラウザは画面を一度タップするまで音を鳴らせない。タップはページを読み込み直すまで有効で、
// アプリ内で画面を移っても続くので、鳴らせるかどうかは画面ごとではなくここでまとめて持つ。
const sounds = new Map<string, HTMLAudioElement>();
const listeners = new Set<() => void>();
let unlocked = false;
let blocked = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function canPlay() {
  return !blocked && (unlocked || (navigator.userActivation?.hasBeenActive ?? false));
}

function getSound(src: string) {
  let sound = sounds.get(src);
  if (!sound) {
    sound = new Audio(src);
    sounds.set(src, sound);
  }
  return sound;
}

/**
 * 通知音。まだ鳴らせない（enabled が false）あいだは画面のタップを待ち、
 * タップされたら試しに一度鳴らして確かめる。
 */
export function useNotificationSound(src: string, playbackRate = 1) {
  const enabled = useSyncExternalStore(subscribe, canPlay, () => false);

  const play = useCallback(() => {
    const sound = getSound(src);
    // 読み込み時に playbackRate は defaultPlaybackRate に戻るので両方に入れる
    sound.defaultPlaybackRate = playbackRate;
    sound.playbackRate = playbackRate;
    sound.currentTime = 0;
    return sound.play().then(
      () => {
        unlocked = true;
        blocked = false;
        notify();
        return true;
      },
      () => {
        blocked = true;
        notify();
        return false;
      }
    );
  }, [src, playbackRate]);

  useEffect(() => {
    if (enabled) return;
    const unlock = () => void play();
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
