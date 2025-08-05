/**
 * @author yujinyan
 * @github https://github.com/halouxiaoyu
 * @description 登录页面组件
 */

import React from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { post } from '@/utils/request';
import { LoginForm } from '@/types';
import type { AuthResponse } from '@/utils/request';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginForm>();

  const onFinish = async (values: LoginForm) => {
    try {
      console.log('=== Login Attempt ===');
      console.log('Form Values:', values);
      console.log('Current URL:', window.location.href);
      console.log('Attempting login request...');
      
      const response = await post<AuthResponse>('/api/auth/login', values);
      
      console.log('=== Login Response ===');
      console.log('Response Data:', response);
      console.log('Token Present:', !!response.token);
      
      if (response.token) {
        console.log('Login successful, setting token and redirecting...');
        localStorage.setItem('token', response.token);
        message.success('登录成功');
        window.location.href = '/admin/questionnaires';
      } else {
        console.error('Login failed - no token in response');
        message.error(response.msg || '登录失败，请检查用户名和密码');
      }
    } catch (error: any) {
      console.error('=== Login Error ===');
      console.error('Error Object:', error);
      
      if (error.response) {
        console.error('Server Response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('No Response Received');
        console.error('Request Details:', error.request);
        message.error('无法连接到服务器，请检查网络连接');
      } else {
        console.error('Request Setup Error:', error.message);
        message.error('登录失败，请稍后重试');
      }
      console.error('=== End Login Error ===\n');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f0f2f5'
    }}>
      <div style={{ 
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
        background: '#fff',
        borderRadius: '12px',
        padding: '24px 16px 32px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ 
          textAlign: 'center', 
          fontSize: '22px', 
          fontWeight: 'bold',
          marginBottom: '8px',
          color: '#222'
        }}>
          医疗问卷系统
        </div>
        <div style={{
          textAlign: 'center',
          color: '#888',
          fontSize: '15px',
          marginBottom: '24px'
        }}>
          请登录以继续操作
        </div>
        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
            label={<span style={{ fontSize: '16px', fontWeight: 'bold', color: '#222' }}>用户名</span>}
          >
            <Input 
              placeholder="请输入用户名" 
              style={{ 
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                padding: '10px 12px',
                fontSize: '15px',
                marginTop: '6px'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
            label={<span style={{ fontSize: '16px', fontWeight: 'bold', color: '#222' }}>密码</span>}
          >
            <Input.Password 
              placeholder="请输入密码" 
              style={{ 
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                padding: '10px 12px',
                fontSize: '15px',
                marginTop: '6px'
              }}
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block
              style={{
                width: '100%',
                background: '#1890ff',
                color: '#fff',
                fontSize: '18px',
                borderRadius: '8px',
                padding: '12px 0',
                border: 'none',
                marginTop: '16px',
                height: 'auto'
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default Login; 