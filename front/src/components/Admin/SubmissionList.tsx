import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Tag, message, Form, Select, Input, Cascader, Popconfirm } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { get, del } from '../../utils/request';
import { useNavigate, useParams } from 'react-router-dom';
import areaOptions from '../Questionnaire/areaOptions';

interface Submission {
  id: number;
  submitted_at: string;
  total_score: number;
  assessment_level: string;
}



interface BasicQuestion {
  id: number;
  text: string;
  type: string;
  options?: { id: number; text: string }[];
}

const SubmissionList: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [basicQuestions, setBasicQuestions] = useState<BasicQuestion[]>([]);
  const [selectedBasicQ, setSelectedBasicQ] = useState<BasicQuestion | undefined>();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // 获取基本信息题目及其选项
  useEffect(() => {
    if (id) {
      get<any>(`/api/stats/questionnaire/${id}/all-basic-questions`).then(res => {
        // 如果是单选题，需获取选项
        const fetchOptions = res.data.map(async (q: BasicQuestion) => {
          if (q.type === 'single') {
            // 获取题目详情，拿到选项
            const detail = await get<any>(`/api/questionnaire/${id}`);
            const found = detail.data.questions.find((qq: any) => qq.id === q.id);
            return { ...q, options: found ? found.options.map((o: any) => ({ id: o.id, text: o.text })) : [] };
          }
          return q;
        });
        Promise.all(fetchOptions).then(setBasicQuestions);
      });
    }
  }, [id]);

  // 查询方法
  const fetchData = (params = {}) => {
    setLoading(true);
    let url = `/api/stats/questionnaire/${id}/submissions`;
    get<Submission[]>(url, params)
      .then(res => setData(res.data || []))
      .catch(() => message.error('加载答卷列表失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const onFinish = (values: any) => {
    console.log('onFinish values:', values);
    const params: any = {};
    if (values.basic_question_id && values.basic_question_value) {
      const selectedQ = basicQuestions.find(q => q.id === values.basic_question_id);
      if (selectedQ && selectedQ.type === 'address') {
        params.area_code_arr = values.basic_question_value;
        params.basic_question_id = values.basic_question_id;
      } else {
        params.basic_question_id = values.basic_question_id;
        params.basic_question_value = values.basic_question_value;
      }
    }
    fetchData(params);
  };

  // 删除答卷
  const handleDelete = async (submissionId: number) => {
    try {
      await del(`/api/stats/questionnaire/${id}/submissions/${submissionId}`);
      message.success('删除成功');
      fetchData(form.getFieldsValue()); // 重新加载列表，保持当前筛选条件
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '答卷ID', dataIndex: 'id', key: 'id' },
    { title: '提交时间', dataIndex: 'submitted_at', key: 'submitted_at' },
    { title: '总分', dataIndex: 'total_score', key: 'total_score' },
    { title: '评估等级', dataIndex: 'assessment_level', key: 'assessment_level', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Submission) => (
        <div>
          <Button 
            icon={<EyeOutlined />} 
            onClick={() => navigate(`/admin/submission/${record.id}`)}
            style={{ marginRight: 8 }}
          >
            查看详情
          </Button>
          <Popconfirm
            title="确定要删除这份答卷吗？删除后将不会出现在统计报表中。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  // 选中题目后，找到完整题目对象
  const handleBasicQChange = (qid: number) => {
    const q = basicQuestions.find(q => q.id === qid);
    setSelectedBasicQ(q);
    form.setFieldsValue({ basic_question_value: undefined });
  };

  return (
    <Card title="答卷者列表">
      <Form
        form={form}
        layout="inline"
        onFinish={onFinish}
        style={{ marginBottom: 16 }}
      >
        <Form.Item name="basic_question_id" label="基本信息字段">
          <Select
            style={{ width: 180 }}
            placeholder="请选择"
            allowClear
            options={basicQuestions.map(q => ({ label: q.text, value: q.id }))}
            onChange={handleBasicQChange}
          />
        </Form.Item>
        {selectedBasicQ && (
          <Form.Item name="basic_question_value" label="内容">
            {selectedBasicQ.type === 'single' ? (
              <Select
                style={{ width: 180 }}
                placeholder="请选择选项"
                allowClear
                options={selectedBasicQ.options?.map(o => ({ label: o.text, value: o.id })) || []}
              />
            ) : selectedBasicQ.type === 'address' ? (
              <Cascader
                options={areaOptions}
                placeholder="可选择省/市/区任意级别"
                allowClear
                style={{ width: 220 }}
                changeOnSelect
              />
            ) : (
              <Input placeholder="支持模糊查询，如输入部分姓名" allowClear />
            )}
          </Form.Item>
        )}
        <Form.Item>
          <Button type="primary" htmlType="submit">查询</Button>
        </Form.Item>
        <Form.Item>
          <Button onClick={() => { form.resetFields(); setSelectedBasicQ(undefined); fetchData(); }}>重置</Button>
        </Form.Item>
      </Form>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 10 }} />
    </Card>
  );
};

export default SubmissionList; 