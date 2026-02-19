import axios from 'axios';

const axiosClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to return data directly
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosClient;
