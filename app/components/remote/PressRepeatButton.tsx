import { safeSelectionAsync } from '@/lib/haptics';
import React, { useEffect, useRef } from 'react';
import { Pressable, PressableProps } from 'react-native';

export type PressRepeatButtonProps = PressableProps & {
  onActivate: () => void | Promise<void>;
  repeat?: boolean;
  intervalMs?: number;
};

export function PressRepeatButton({ onActivate, repeat = false, intervalMs = 120, ...rest }: PressRepeatButtonProps) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  const clear = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    activeRef.current = false;
  };

  useEffect(() => clear, []);

  const start = async () => {
    activeRef.current = true;
  await safeSelectionAsync();
    await onActivate();
    if (repeat) {
      timerRef.current = setInterval(() => {
        if (!activeRef.current) return;
        onActivate();
      }, intervalMs);
    }
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={clear}
      {...rest}
    />
  );
}
