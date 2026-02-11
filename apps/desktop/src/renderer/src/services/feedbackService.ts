export interface FeedbackService {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
}

const showAlert = (message: string): void => {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message);
    return;
  }

  console.warn(`[feedback] ${message}`);
};

const showConfirm = async (message: string): Promise<boolean> => {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }

  console.warn(`[feedback:confirm:fallback=true] ${message}`);
  return true;
};

// Minimal unified boundary. Can be swapped with toast/modal implementation later.
export const feedbackService: FeedbackService = {
  info: showAlert,
  success: showAlert,
  error: showAlert,
  confirm: showConfirm,
};
