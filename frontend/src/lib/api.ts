import axios from 'axios';

const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
export const BASE_URL = isLocalhost ? 'http://localhost:9000' : window.location.origin;

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
});

// Configure Request & Response Interceptors for Auth
const setupAuthInterceptors = (instance: any) => {
  instance.interceptors.request.use((config: any) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('lumbungs3_token');
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  }, (error: any) => Promise.reject(error));

  instance.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      if (error.response && error.response.status === 401) {
        if (typeof window !== 'undefined') {
          const isSharePath = window.location.pathname.startsWith('/share/');
          if (!isSharePath && localStorage.getItem('lumbungs3_token')) {
            localStorage.removeItem('lumbungs3_token');
            window.location.reload();
          }
        }
      }
      return Promise.reject(error);
    }
  );
};

setupAuthInterceptors(api);
setupAuthInterceptors(axios);

// Buckets
export const getBuckets = async () => {
  const response = await api.get('/buckets');
  return response.data;
};

export const createBucket = async (name: string) => {
  const response = await api.post('/buckets', { name });
  return response.data;
};

export const deleteBucket = async (id: string) => {
  const response = await api.delete(`/buckets/${id}`);
  return response.data;
};

export const updateBucketVisibility = async (id: string, visibility: 'public' | 'private') => {
  const response = await api.patch(`/buckets/${id}/visibility`, { visibility });
  return response.data;
};

// Objects
export const getObjects = async (bucketName: string, prefix: string = '') => {
  const response = await axios.get(`${BASE_URL}/objects/${bucketName}`, {
    params: { prefix }
  });
  return response.data;
};

export const uploadObject = async (bucketName: string, key: string, file: File, onProgress?: (percent: number) => void) => {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  
  if (file.size <= CHUNK_SIZE) {
    // Single part upload
    const response = await axios.put(`${BASE_URL}/objects/${bucketName}/${key}`, file, {
      headers: { 'Content-Type': file.type },
      onUploadProgress: (p) => onProgress?.(Math.round((p.loaded * 100) / (p.total || file.size)))
    });
    return response.data;
  }

  // Multipart upload
  // 1. Initiate
  const initRes = await axios.post(`${BASE_URL}/objects/${bucketName}/${key}?uploads`, {}, {
    headers: { 'Content-Type': file.type }
  });
  const { uploadId } = initRes.data;

  try {
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    
    // 2. Upload Parts
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      await axios.put(`${BASE_URL}/objects/${bucketName}/${key}?uploadId=${uploadId}&partNumber=${partNumber}`, blob);
      onProgress?.(Math.round(((i + 1) * 100) / totalParts));
    }

    // 3. Complete
    const completeRes = await axios.post(`${BASE_URL}/objects/${bucketName}/${key}?uploadId=${uploadId}`);
    return completeRes.data;
  } catch (error) {
    // 4. Abort on failure
    await axios.delete(`${BASE_URL}/objects/${bucketName}/${key}?uploadId=${uploadId}`);
    throw error;
  }
};

export const deleteObject = async (bucketName: string, key: string) => {
  const response = await axios.delete(`${BASE_URL}/objects/${bucketName}/${key}`);
  return response.data;
};

export const presignObject = async (bucketName: string, key: string, expires: number = 3600) => {
  const response = await axios.post(`${BASE_URL}/objects/${bucketName}/${key}/presign`, { expires });
  return response.data;
};

// File Sharing
export const createShare = async (bucketName: string, key: string, expiresAt?: string) => {
  const response = await api.post('/shares', { bucketName, key, expiresAt });
  return response.data;
};

export const getShares = async () => {
  const response = await api.get('/shares');
  return response.data;
};

export const revokeShare = async (id: string) => {
  const response = await api.delete(`/shares/${id}`);
  return response.data;
};

export const getPublicShare = async (id: string) => {
  const response = await api.get(`/shares/public/${id}`);
  return response.data;
};

// Metrics
export const getMetrics = async () => {
  const response = await api.get('/metrics');
  return response.data;
};

// CORS Settings
export const getCorsRules = async () => {
  const response = await api.get('/keys/cors');
  return response.data;
};

export const getCorsRuleForBucket = async (bucketId: string) => {
  const response = await api.get(`/keys/cors/bucket/${bucketId}`);
  return response.data;
};

export const saveCorsRule = async (data: {
  bucketId: string;
  allowedOrigins: string;
  allowedMethods: string;
  allowedHeaders?: string;
  maxAge?: number;
}) => {
  const response = await api.post('/keys/cors', data);
  return response.data;
};

export const deleteCorsRule = async (id: string) => {
  const response = await api.delete(`/keys/cors/${id}`);
  return response.data;
};

export default api;
