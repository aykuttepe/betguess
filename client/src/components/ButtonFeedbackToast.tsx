import { useEffect, useRef, useState } from 'react';
import {
  BUTTON_FEEDBACK_EVENT,
  ButtonFeedbackDetail,
  ButtonFeedbackTone,
} from '../lib/button-feedback';

interface FeedbackState {
  id: number;
  message: string;
  tone: ButtonFeedbackTone;
}

const TONE_CLASS: Record<ButtonFeedbackTone, string> = {
  info: 'button-feedback-info',
  success: 'button-feedback-success',
  warning: 'button-feedback-warning',
  error: 'button-feedback-error',
};

function getFeedbackButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLButtonElement>('button');
}

export default function ButtonFeedbackToast() {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pressTimersRef = useRef(new WeakMap<HTMLButtonElement, number>());

  useEffect(() => {
    function show(detail: ButtonFeedbackDetail) {
      if (!detail.message) return;

      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }

      setFeedback({
        id: Date.now(),
        message: detail.message,
        tone: detail.tone || 'info',
      });

      hideTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
      }, 2400);
    }

    function onFeedback(event: Event) {
      show((event as CustomEvent<ButtonFeedbackDetail>).detail || {});
    }

    function onClick(event: MouseEvent) {
      const button = getFeedbackButton(event.target);
      if (!button || button.disabled) return;

      const message = button.dataset.feedback;
      if (!message) return;

      show({
        message,
        tone: (button.dataset.feedbackTone as ButtonFeedbackTone | undefined) || 'info',
      });
    }

    function onPointerDown(event: PointerEvent) {
      const button = getFeedbackButton(event.target);
      if (!button || button.disabled) return;

      const previousTimer = pressTimersRef.current.get(button);
      if (previousTimer) {
        window.clearTimeout(previousTimer);
      }

      button.classList.remove('button-press-feedback');
      window.requestAnimationFrame(() => {
        button.classList.add('button-press-feedback');
      });

      const nextTimer = window.setTimeout(() => {
        button.classList.remove('button-press-feedback');
        pressTimersRef.current.delete(button);
      }, 190);
      pressTimersRef.current.set(button, nextTimer);
    }

    window.addEventListener(BUTTON_FEEDBACK_EVENT, onFeedback);
    document.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener(BUTTON_FEEDBACK_EVENT, onFeedback);
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onPointerDown);
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  if (!feedback) return null;

  return (
    <div
      key={feedback.id}
      className={`button-feedback-toast ${TONE_CLASS[feedback.tone]}`}
      role="status"
      aria-live="polite"
    >
      {feedback.message}
    </div>
  );
}
