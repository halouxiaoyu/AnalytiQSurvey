import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Select } from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { get, put } from '@/utils/request';

const { TextArea } = Input;

const QuestionnaireEdit: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [parentList, setParentList] = useState<any[]>([]);

  useEffect(() => {
    // 获取所有父问卷（parent_id为null，且不是自己）
    get('/api/questionnaire/').then(res => {
      if (Array.isArray(res.data)) {
        setParentList(res.data.filter((q: any) => !q.parent_id && String(q.id) !== String(id)));
      }
    });
  }, [id]);

  useEffect(() => {
    const fetchQuestionnaire = async () => {
      try {
        setLoading(true);
        const res = await get(`/api/questionnaire/${id}`);
        if (res.data) {
          form.setFieldsValue({
            title: res.data.title,
            description: res.data.description,
            parent_id: res.data.parent_id || undefined
          });
        }
      } catch (error) {
        message.error('获取问卷信息失败');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuestionnaire();
    }
  }, [id, form]);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      await put(`/api/questionnaire/${id}`, values);
      message.success('问卷更新成功');
      navigate('/admin/questionnaires');
    } catch (error) {
      message.error('更新失败，请重试');
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

        {/* 只有有 parent_id 时才显示父问卷，并且不可编辑 */}
        {form.getFieldValue('parent_id') && (
          <Form.Item label="父问卷" name="parent_id">
            <Select disabled options={parentList.map(q => ({ label: q.title, value: q.id }))} />
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存修改
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default QuestionnaireEdit;
