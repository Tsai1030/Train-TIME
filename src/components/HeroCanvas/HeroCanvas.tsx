import { useEffect, useRef } from 'react';
import type { TrainSceneHandle } from '../../three/trainScene';

interface Props {
  onReady: (h: TrainSceneHandle | null) => void;
  accent: string;
  accent2: string;
}

/** 固定於首頁背景的 three.js 真實感列車；three 採動態載入以縮小首包 */
export function HeroCanvas({ onReady, accent, accent2 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: TrainSceneHandle | null = null;
    let cancelled = false;

    const onPointer = (e: PointerEvent) => {
      scene?.setPointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    };

    import('../../three/trainScene').then(({ createTrainScene }) => {
      if (cancelled) return;
      scene = createTrainScene(canvas, accent, accent2);
      onReady(scene);
    });

    window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', onPointer);
      onReady(null);
      scene?.destroy();
    };
    // onReady 為穩定 ref setter，不列入依賴
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, accent2]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden
    />
  );
}
