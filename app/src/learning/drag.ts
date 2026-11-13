import { useEffect, useState } from 'react';
import type { GestureResponderEvent, GestureResponderHandlers } from 'react-native';

/** How far, in points, a finger moves before a `grab: 'move'` drag takes the touch from a tap. */
export const DRAG_SLOP = 10;

/** Where the finger is, and how far it has come since it went down. */
export type DragPoint = { pageX: number; pageY: number; dx: number; dy: number };

export type DragOptions = {
  enabled: boolean;
  /**
   * `press` grabs on touch-down, for a target where a tap also places.
   * `move` waits for `DRAG_SLOP`, so a tap still reaches a button inside.
   */
  grab: 'press' | 'move';
  onGrab?: (e: GestureResponderEvent) => void;
  onMove?: (p: DragPoint) => void;
  onDrop?: (p: DragPoint) => void;
  /** Another view took the touch, or the system cancelled it. */
  onCancel?: () => void;
};

/**
 * Responder props for a draggable view. Spread them on the view. Once grabbed, the drag keeps
 * the touch even if a parent scroll view asks for it.
 */
export function useDrag(options: DragOptions): GestureResponderHandlers {
  const [live] = useState({ ...options, x0: 0, y0: 0 });
  useEffect(() => {
    Object.assign(live, options);
  });

  const [handlers] = useState<GestureResponderHandlers>(() => {
    const point = (e: GestureResponderEvent): DragPoint => {
      const { pageX, pageY } = e.nativeEvent;
      return { pageX, pageY, dx: pageX - live.x0, dy: pageY - live.y0 };
    };
    const far = (e: GestureResponderEvent) => {
      const { dx, dy } = point(e);
      return Math.abs(dx) + Math.abs(dy) > DRAG_SLOP;
    };
    return {
      // Capture sees every touch-down, even one a child button claims, so `dx` starts there.
      onStartShouldSetResponderCapture: (e) => {
        live.x0 = e.nativeEvent.pageX;
        live.y0 = e.nativeEvent.pageY;
        return false;
      },
      onStartShouldSetResponder: () => live.enabled && live.grab === 'press',
      onMoveShouldSetResponder: (e) => live.enabled && (live.grab === 'press' || far(e)),
      onResponderTerminationRequest: () => false,
      onResponderGrant: (e) => live.onGrab?.(e),
      onResponderMove: (e) => live.onMove?.(point(e)),
      onResponderRelease: (e) => live.onDrop?.(point(e)),
      onResponderTerminate: () => live.onCancel?.(),
    };
  });
  return handlers;
}
