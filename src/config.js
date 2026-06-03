// Configuration for the frontend application
// Exposes the backend API URL dynamically based on environment variables
export const API_BASE = import.meta.env.VITE_API_URL || '';
