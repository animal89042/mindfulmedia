export const { STEAM_API_KEY, PORT = 5000, SESSION_SECRET } = process.env;

export const isProd = process.env.NODE_ENV === 'production';
export const FRONTEND_BASE = isProd ? process.env.PUBLIC_URL : "http://localhost:3000";
export const BACKEND_BASE = isProd ? process.env.PUBLIC_API_URL : "http://localhost:5000";