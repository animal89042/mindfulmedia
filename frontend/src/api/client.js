import axios from "axios";

const isProd = process.env.NODE_ENV === "production";
export const BASE = isProd ? "https://mindfulmedia-production-g.up.railway.app/api": "/api";

export const api = axios.create({
    baseURL: BASE,
    withCredentials: true,
});