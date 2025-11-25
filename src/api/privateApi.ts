import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config";

export const privateApi = axios.create({
  baseURL: API_URL,
});

privateApi.interceptors.request.use(
  async (config: any) => {
    const token = await AsyncStorage.getItem("access_token");
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);
