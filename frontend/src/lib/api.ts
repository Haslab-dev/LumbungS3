import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:9000/api',
});

export const getBuckets = async () => {
  const response = await api.get('/buckets');
  return response.data;
};

export const getMetrics = async () => {
  const response = await api.get('/metrics');
  return response.data;
};

export default api;
