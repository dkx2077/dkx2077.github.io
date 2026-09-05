/** Camera position never changes. Angles are degrees, positive pitch looks upward. */
export const FIXED_POSITION = Object.freeze([0, 2.8, 0]);
export const DISTRICTS = Object.freeze({ home: 0, research: 66, awards: 176, work: 268 });
export function clampPitch(value, min = -28, max = 48) {
  return Math.max(min, Math.min(max, value));
}
export function shortestAngle(from, to) {
  return from + ((((to - from) % 360) + 540) % 360) - 180;
}
export function direction(yaw, pitch) {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  return [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)];
}
export function createLookControls(
  element,
  { minPitch, maxPitch, reducedMotion, onChange, signal }
) {
  const current = { yaw: 0, pitch: 9 };
  const target = { ...current };
  let pointer = null;
  let start = null;
  let last = null;
  let dragged = false;
  let blockClickUntil = 0;
  const setTarget = (yaw, pitch) => {
    target.yaw = yaw;
    target.pitch = clampPitch(pitch, minPitch, maxPitch);
    onChange();
  };
  const end = event => {
    if (event.pointerId !== pointer) return;
    if (dragged) blockClickUntil = performance.now() + 250;
    if (element.hasPointerCapture?.(pointer)) element.releasePointerCapture(pointer);
    pointer = null;
    element.classList.remove('dragging');
  };
  element.addEventListener(
    'pointerdown',
    event => {
      if (event.button !== 0 || !event.isPrimary || pointer !== null) return;
      pointer = event.pointerId;
      start = last = { x: event.clientX, y: event.clientY };
      dragged = false;
      // Delay capture until an actual drag so a tap on a native sign anchor still clicks it.
    },
    { signal }
  );
  element.addEventListener(
    'pointermove',
    event => {
      if (pointer !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (!dragged && distance < 7) return;
      if (!dragged) {
        dragged = true;
        element.setPointerCapture?.(pointer);
        element.classList.add('dragging');
      }
      const sensitivity = event.pointerType === 'touch' ? 0.16 : 0.115;
      setTarget(
        target.yaw - (event.clientX - last.x) * sensitivity,
        target.pitch + (event.clientY - last.y) * sensitivity
      );
      last = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    },
    { signal }
  );
  element.addEventListener('pointerup', end, { signal });
  element.addEventListener('pointercancel', end, { signal });
  window.addEventListener('pointerup', end, { signal });
  element.addEventListener(
    'lostpointercapture',
    () => {
      pointer = null;
    },
    { signal }
  );
  element.addEventListener(
    'click',
    event => {
      if (performance.now() < blockClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, signal }
  );
  element.addEventListener(
    'keydown',
    event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      const step = event.shiftKey ? 12 : 4;
      if (event.key === 'Home') setTarget(shortestAngle(current.yaw, 0), 9);
      else
        setTarget(
          target.yaw + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
          target.pitch + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0)
        );
      event.preventDefault();
    },
    { signal }
  );
  return {
    current,
    lookAt(yaw, pitch = 9) {
      setTarget(shortestAngle(current.yaw, yaw), pitch);
    },
    update(dt) {
      const blend = reducedMotion() ? 1 : 1 - Math.exp(-12 * dt);
      current.yaw += (target.yaw - current.yaw) * blend;
      current.pitch += (target.pitch - current.pitch) * blend;
      // Rebase only by whole revolutions; horizontal movement never hits an end stop.
      if (Math.abs(current.yaw) > 3600) {
        const offset = Math.trunc(current.yaw / 360) * 360;
        current.yaw -= offset;
        target.yaw -= offset;
      }
      return Math.abs(target.yaw - current.yaw) + Math.abs(target.pitch - current.pitch) > 0.008;
    },
  };
}
