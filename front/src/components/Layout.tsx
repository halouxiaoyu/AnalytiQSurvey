/**
 * @author yujinyan
 * @github https://github.com/halouxiaoyu
 * @description 主布局组件
 */

import React, { useState } from 'react';
import { Layout, Button, Modal, Form, Input, message, Space } from 'antd';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { post } from '@/utils/request';
import { FileTextOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const [resetVisible, setResetVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // 重置密码
  const handleResetPassword = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const res = await post('/api/auth/password', values);
      if (res.msg === 'Password updated') {
        message.success('密码修改成功，请重新登录');
        setResetVisible(false);
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        message.error(res.msg || '修改失败');
      }
    } catch (e) {
      // 校验失败等
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px #f0f1f2' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 64, padding: '0 32px' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14
          }}>
            <FileTextOutlined style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#222', letterSpacing: 1 }}>
            <Link to="/admin/questionnaires" style={{ color: '#222', textDecoration: 'none' }}>
              医疗问卷系统
            </Link>
          </span>
        </div>
        <Space style={{ marginRight: 24 }}>
          <Button onClick={() => setResetVisible(true)}>重置密码</Button>
          <Button danger onClick={handleLogout}>退出登录</Button>
        </Space>
        <Modal
          title="重置密码"
          open={resetVisible}
          onOk={handleResetPassword}
          onCancel={() => setResetVisible(false)}
          okText="确定"
          cancelText="取消"
          confirmLoading={loading}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="old_password"
              label="旧密码"
              rules={[{ required: true, message: '请输入旧密码' }]}
            >
              <Input.Password placeholder="请输入旧密码" autoComplete="current-password" />
            </Form.Item>
            <Form.Item
              name="new_password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '至少6位' }
              ]}
            >
              <Input.Password placeholder="请输入新密码" autoComplete="new-password" />
            </Form.Item>
          </Form>
        </Modal>
      </Header>
      <Content style={{ padding: '24px', background: '#fff' }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default AppLayout; 