export const BUTTON_FEEDBACK_EVENT = 'betguess:button-feedback';

export type ButtonFeedbackTone = 'info' | 'success' | 'warning' | 'error';

export interface ButtonFeedbackDetail {
  message: string;
  tone?: ButtonFeedbackTone;
}

export function showButtonFeedback(message: string, tone: ButtonFeedbackTone = 'info') {
  window.dispatchEvent(
    new CustomEvent<ButtonFeedbackDetail>(BUTTON_FEEDBACK_EVENT, {
      detail: { message, tone },
    })
  );
}
