'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocalVideoTrack } from 'livekit-client';

/**
 * Phase 7.7 — camera background effects.
 *
 * We use @livekit/track-processors (`BackgroundBlur` / `VirtualBackground`)
 * which run MediaPipe Selfie Segmentation entirely client-side via wasm
 * + WebGL. No frames are ever uploaded; the processor sits between the
 * raw camera and the encoder.
 *
 * Hook lifecycle:
 *   - When `effect` is 'none', any previously attached processor is
 *     stopped and the camera goes back to the raw stream.
 *   - When `effect` is 'blur', BackgroundBlur(intensity) is attached.
 *   - When `effect` is 'virtual', VirtualBackground(imageDataUrl) is
 *     attached. We also keep the previous data URL around so navigating
 *     menus doesn't lose the user's selection.
 *   - When the underlying track changes (camera toggled off/on, device
 *     switched, room reconnect), we re-attach the processor so the
 *     effect "follows" the camera.
 *
 * Error handling:
 *   - If the device can't run the processor (no MediaPipe, no WebGL,
 *     iOS Safari < 16), `unsupported` is set to true so the menu can
 *     show a Persian fallback.
 *   - If processor attach itself fails (rare), `error` carries the
 *     message and the camera falls back to the raw stream.
 *
 * SSR: all browser-only logic lives inside effects. The hook never
 * touches `navigator` during render.
 */

export type CameraEffect = 'none' | 'blur' | 'virtual';

export interface UseCameraEffects {
  effect: CameraEffect;
  /** Data URL of the active virtual-background image (or null). */
  virtualImage: string | null;
  unsupported: boolean;
  /** True while a processor swap is in flight. */
  isApplying: boolean;
  error: string | null;
  setEffect: (effect: CameraEffect) => void;
  /** Set a new virtual-background image from a local File. */
  setVirtualImage: (file: File | null) => void;
  clearError: () => void;
}

interface Options {
  videoTrack: LocalVideoTrack | null;
  /** Disable when not connected so we don't spin up MediaPipe pointlessly. */
  enabled: boolean;
}

const STORAGE_KEY_EFFECT = 'meetino:camera:effect';
const STORAGE_KEY_IMAGE = 'meetino:camera:vbg-image';

export function useCameraEffects({ videoTrack, enabled }: Options): UseCameraEffects {
  const [effect, setEffectState] = useState<CameraEffect>('none');
  const [virtualImage, setVirtualImageState] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // We dynamically import the processor module the first time we need it —
  // it's ~1 MB of wasm and we don't want to pay that on every page load.
  const processorsRef = useRef<typeof import('@livekit/track-processors') | null>(null);

  const loadProcessors = useCallback(async () => {
    if (processorsRef.current) return processorsRef.current;
    try {
      const mod = await import('@livekit/track-processors');
      processorsRef.current = mod;
      return mod;
    } catch (err) {
      setUnsupported(true);
      throw err;
    }
  }, []);

  // Restore the user's last preference from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const e = window.localStorage.getItem(STORAGE_KEY_EFFECT);
      if (e === 'blur' || e === 'virtual') setEffectState(e);
      const img = window.localStorage.getItem(STORAGE_KEY_IMAGE);
      if (img) setVirtualImageState(img);
    } catch {
      // ignore (private mode etc.)
    }
  }, []);

  // Persist user choices.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY_EFFECT, effect);
    } catch {
      // ignore
    }
  }, [effect]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (virtualImage) window.localStorage.setItem(STORAGE_KEY_IMAGE, virtualImage);
      else window.localStorage.removeItem(STORAGE_KEY_IMAGE);
    } catch {
      // ignore
    }
  }, [virtualImage]);

  // Re-apply the processor whenever (track, effect, virtualImage, enabled) changes.
  useEffect(() => {
    if (!enabled) return;
    if (!videoTrack) return;

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        setIsApplying(true);

        if (effect === 'none') {
          await videoTrack.stopProcessor?.();
          return;
        }

        const mod = await loadProcessors();
        if (cancelled) return;

        let processor: ReturnType<typeof mod.BackgroundBlur>;
        if (effect === 'blur') {
          processor = mod.BackgroundBlur(10);
        } else {
          if (!virtualImage) {
            // No image picked — leave the previous effect alone.
            return;
          }
          processor = mod.VirtualBackground(virtualImage);
        }

        await videoTrack.setProcessor(processor);
      } catch (err) {
        if (cancelled) return;
        const message = (err as Error)?.message ?? 'افکت دوربین اعمال نشد.';
        setError(message);
        // Fall back to the raw camera so the user isn't stuck on a frozen frame.
        try {
          await videoTrack.stopProcessor?.();
        } catch {
          // ignore
        }
      } finally {
        if (!cancelled) setIsApplying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoTrack, effect, virtualImage, enabled, loadProcessors]);

  const setEffect = useCallback((next: CameraEffect) => {
    setEffectState(next);
  }, []);

  const setVirtualImage = useCallback<UseCameraEffects['setVirtualImage']>((file) => {
    if (!file) {
      setVirtualImageState(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (result) {
        setVirtualImageState(result);
        // If the user selected an image without having "virtual" active, flip to it.
        setEffectState('virtual');
      }
    };
    reader.onerror = () => setError('بارگذاری تصویر ناموفق بود.');
    reader.readAsDataURL(file);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Quick capability check — devices without OffscreenCanvas + WebGL can't
  // run the processor at acceptable speed. We don't hard-block, just hint.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasOffscreen = 'OffscreenCanvas' in window;
    const canvas = document.createElement('canvas');
    const hasWebGL = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    if (!hasOffscreen || !hasWebGL) setUnsupported(true);
  }, []);

  return useMemo(
    () => ({
      effect,
      virtualImage,
      unsupported,
      isApplying,
      error,
      setEffect,
      setVirtualImage,
      clearError,
    }),
    [effect, virtualImage, unsupported, isApplying, error, setEffect, setVirtualImage, clearError],
  );
}
