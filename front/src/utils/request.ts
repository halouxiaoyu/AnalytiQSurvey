import axios from 'axios';
import { message } from 'antd';

interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface AuthResponse {
  admin_id: number;
  msg: string;
  token: string;
}

// 是否启用详细日志（开发环境）
const isDev = process.env.NODE_ENV === 'development';

// 创建axios实例
const instance = axios.create({
  baseURL: '/',  // 使用相对路径，让 Vite 代理处理请求转发
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // 允许跨域请求携带凭证
});

// 请求拦截器
instance.interceptors.request.use(
  config => {
    // 只在开发环境输出详细日志
    if (isDev) {
      console.log('=== Request Details ===');
      console.log('URL:', config.url);
      console.log('Method:', config.method);
      if (config.data) {
        console.log('Request Data:', config.data);
      }
      if (config.params) {
        console.log('Request Params:', config.params);
      }
    }
    
    // 从localStorage获取token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (isDev) {
        console.log('Added Authorization Token:', token);
      }
    }
    
    if (isDev) {
      console.log('=== End Request Details ===\n');
    }
    return config;
  },
  error => {
    console.error('Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  response => {
    // 只在开发环境输出详细日志
    if (isDev) {
      console.log('=== Response Details ===');
      console.log('Status:', response.status);
      console.log('Data:', response.data);
      console.log('=== End Response Details ===\n');
    }

    const res = response.data;
    // 处理登录响应
    if (response.config.url?.includes('/auth/login')) {
      return res;
    }
    // 处理标准API响应
    if (res.code !== undefined && res.code !== 0) {
      if (isDev) {
        console.error('API Error Response:', res);
      }
      if (res.code === 404 && res.msg.includes('问卷不存在或已下架')) {
        message.warning(res.msg);
      } else {
      message.error(res.msg || '请求失败');
      }
      return Promise.reject(new Error(res.msg || '请求失败'));
    }
    // 处理没有code字段的响应
    if (res.msg === 'Success') {
      return res;
    }
    return res;
  },
  error => {
    // 错误信息始终输出，但简化输出
    if (isDev) {
      console.error('=== Response Error Details ===');
      console.error('Error:', error);
      console.error('Error Config:', error.config);
      if (error.response) {
        console.error('Error Response:', {
          status: error.response.status,
          headers: error.response.headers,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('Error Request:', error.request);
      }
      console.error('=== End Response Error Details ===\n');
    } else {
      // 生产环境只输出关键错误信息
      console.error('API Error:', error.response?.status, error.message);
    }

    if (error.response?.status === 401) {
      // 如果是登录请求，显示服务器返回的错误信息
      if (error.config.url?.includes('/auth/login')) {
        message.error(error.response.data.msg || '登录失败');
      } else {
        // 其他401错误（如token过期）才显示登录过期
        localStorage.removeItem('token');
        message.error('登录已过期，请重新登录');
      }
    } else {
      // 显示具体的错误信息
      const errorMsg = error.response?.data?.msg || error.message || '请求失败';
      message.error(errorMsg);
    }
    return Promise.reject(error);
  }
);

export const get = <T>(url: string, params?: any): Promise<ApiResponse<T>> => {
  return instance.get<any, ApiResponse<T>>(url, { params });
};

export const post = <T>(url: string, data?: any): Promise<T extends AuthResponse ? T : ApiResponse<T>> => {
  return instance.post(url, data);
};

export const put = <T>(url: string, data?: any): Promise<ApiResponse<T>> => {
  return instance.put<any, ApiResponse<T>>(url, data);
};

export const del = <T>(url: string): Promise<ApiResponse<T>> => {
  return instance.delete<any, ApiResponse<T>>(url);
}; 