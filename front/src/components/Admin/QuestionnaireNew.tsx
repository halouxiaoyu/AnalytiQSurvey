import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Select } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { post, get } from '@/utils/request';

const { TextArea } = Input;

const QuestionnaireNew: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const parentId = searchParams.get('parent_id');
  const [loading, setLoading] = useState(false);
  const [parentList, setParentList] = useState<any[]>([]);

  useEffect(() => {
    // 获取所有父问卷（parent_id为null）
    get('/api/questionnaire/').then(res => {
      if (Array.isArray(res.data)) {
        setParentList(res.data.filter((q: any) => !q.parent_id));
      }
    });
    // 如果是新增子问卷，设置表单初始值
    if (parentId) {
      form.setFieldsValue({ parent_id: Number(parentId) });
    }
  }, [parentId, form]);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      // 如果是新增子问卷，强制带上 parent_id
      if (parentId) {
        values.parent_id = Number(parentId);
      } else {
        delete values.parent_id;
      }
      const response = await post('/api/questionnaire/', values);
      if (response.msg === 'Success') {
        message.success('问卷创建成功');
        navigate('/admin/questionnaires');
      } else {
        message.error(response.msg || '创建失败');
      }
    } catch (error) {
      message.error('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qe-card">
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
      >
        <Form.Item
          label="问卷标题"
          name="title"
          rules={[{ required: true, message: '请输入问卷标题' }]}
        >
          <Input placeholder="请输入问卷标题" />
        </Form.Item>

        <Form.Item
          label="问卷描述"
          name="description"
          rules={[{ required: true, message: '请输入问卷描述' }]}
        >
          <TextArea 
            placeholder="请输入问卷描述"
            rows={4}
          />
        </Form.Item>

        {/* 只有新增子问卷时才显示父问卷，并且不可编辑 */}
        {parentId && (
          <Form.Item label="父问卷" name="parent_id">
            <Select disabled options={parentList.map(q => ({ label: q.title, value: q.id }))} />
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            创建问卷
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default QuestionnaireNew;
