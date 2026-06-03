// Exposes the backend API URL dynamically based on environment variables
const getApiBase = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.DEV) {
        return '';
      }
      return import.meta.env.VITE_API_URL || '';
    }
  } catch (e) {
    console.warn('Could not read environment variables:', e);
  }
  return '';
};

export const API_BASE = getApiBase();
