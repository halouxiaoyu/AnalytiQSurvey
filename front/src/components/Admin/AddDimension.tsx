import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, message, Card, List, Space, Typography, Popconfirm } from 'antd';
import { post, get, del, put } from '@/utils/request';
import { useParams, useNavigate } from 'react-router-dom';
import { DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface Dimension {
  id: number;
  name: string;
  weight: number;
}

interface QuestionnaireData {
  dimensions: Dimension[];
  // ...其他字段
}

interface QuestionnaireResponse {
  code: number;
  msg: string;
  data: QuestionnaireData;
}

const AddDimension: React.FC = () => {
  const [form] = Form.useForm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(null);

  // 获取已有维度
  const fetchDimensions = async () => {
    try {
      setFetching(true);
      const response = await get<QuestionnaireResponse>(`/api/questionnaire/${id}`);
      if (response.data && response.data.dimensions) {
        setDimensions(response.data.dimensions);
      }
    } catch (e: any) {
      console.error('Error fetching dimensions:', e);
      message.error('获取维度列表失败');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDimensions();
    }
  }, [id]);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      if (editingDimension) {
        // 编辑模式
        const response = await put(
          `/api/questionnaire/${id}/dimension/${editingDimension.id}`,
          values
        );
        if (response.msg === 'Success') {
          message.success('编辑维度成功');
          setEditingDimension(null);
          await fetchDimensions();
          form.resetFields();
        } else {
          message.error(response.msg || '编辑失败');
        }
      } else {
        // 新增模式
        const response = await post(`/api/questionnaire/${id}/add-dimension`, values);
        if (response.msg === 'Success') {
          message.success('新增维度成功');
          await fetchDimensions();
          form.resetFields();
        } else {
          message.error(response.msg || '新增失败');
        }
      }
    } catch (e: any) {
      console.error('Error:', e);
      message.error(e.response?.data?.msg || e.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (dimensionId: number) => {
    try {
      setLoading(true);
      const response = await del(`/api/questionnaire/${id}/dimension/${dimensionId}`);
      if (response.msg === 'Success' || response.msg === '删除成功') {
        message.success('删除维度成功');
        await fetchDimensions();
      } else {
        message.error(response.msg || '删除失败');
      }
    } catch (e: any) {
      console.error('Error deleting dimension:', e);
      message.error(e.response?.data?.msg || e.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (dimensions.length === 0) {
      message.warning('请至少添加一个维度');
      return;
    }
    navigate('/admin/questionnaires');
  };

  return (
    <Card title={editingDimension ? '编辑维度' : '新增维度'}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="维度名称" name="name" rules={[{ required: true, message: '请输入维度名称' }]}>
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item 
            label="权重" 
            name="weight" 
            rules={[{ required: true, type: 'number', min: 0, max: 1000, message: '请输入0~1000之间的数字，可保留两位小数' }]}
            extra="允许输入范围：0~1000"
          >
            <InputNumber min={0} max={1000} step={0.01} precision={2} />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingDimension ? '保存修改' : '保存维度'}
              </Button>
              {editingDimension && (
                <Button
                  onClick={() => {
                    setEditingDimension(null);
                    form.resetFields();
                  }}
                  disabled={loading}
                >
                  取消编辑
                </Button>
              )}
              <Button onClick={handleComplete}>返回首页</Button>
            </div>
          </Form.Item>
        </Form>

        <div>
          <Title level={5}>维度列表</Title>
          <List
            bordered
            loading={fetching}
            dataSource={dimensions}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  item.name === '用户基本信息(不参与得分评估)' ? (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled
                    >
                      删除
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="link"
                        onClick={() => {
                          setEditingDimension(item);
                          form.setFieldsValue({ name: item.name, weight: item.weight });
                        }}
                        style={{ marginRight: 8 }}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定要删除这个维度吗？"
                        onConfirm={() => handleDelete(item.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          loading={loading}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </>
                  )
                ]}
              >
                <Space>
                  <span>{index + 1}. {item.name}</span>
                  <span>权重: {item.weight}</span>
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </Card>
  );
};

export default AddDimension;
