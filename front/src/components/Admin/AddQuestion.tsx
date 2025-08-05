import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Card, message, Space, Switch, InputNumber, Collapse, Divider, Table, List, Typography, Popconfirm, Tag } from 'antd';
import { PlusOutlined, MinusCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { post, get, del, put } from '@/utils/request';
import { useParams, useNavigate } from 'react-router-dom';

const { Title } = Typography;

const QUESTION_TYPES = [
  { label: '单选', value: 'single' },
  { label: '多选', value: 'multiple' },
  { label: '填空', value: 'text' },
  { label: '地址', value: 'address' },
];

interface Question {
  id: number;
  text: string;
  type: string;
  dimension_id?: number;
  options: Array<{
    id: number;
    text: string;
    value: number;
    is_other: boolean;
  }>;
  branch_rules: Array<{
    option_id: number;
    next_questionnaire_id: number;
  }>;
  order: number;
}

interface Dimension {
  id: number;
  name: string;
}

interface QuestionnaireData {
  dimensions: Dimension[];
  questions: Question[];
  parent_id?: number;
  title?: string;
}

interface QuestionnaireResponse {
  code: number;
  msg: string;
  data: QuestionnaireData;
}

interface QuestionnaireListItem {
  id: number;
  title: string;
  parent_id?: number;
  status?: string;
}

const AddQuestion: React.FC = () => {
  const [form] = Form.useForm();
  const { id } = useParams<{ id: string }>();
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionnaireList, setQuestionnaireList] = useState<QuestionnaireListItem[]>([]);
  const [options, setOptions] = useState<Array<{ id: number; text: string; value: number; is_other: boolean }>>([]);
  const [branchRules, setBranchRules] = useState<Array<{ option_id: number | null; next_questionnaire_id: number | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const navigate = useNavigate();
  const [questionType, setQuestionType] = useState<string>('single');
  const [questionnaireInfo, setQuestionnaireInfo] = useState<QuestionnaireData | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // 计算题目最大分
  const calculateQuestionMaxScore = (question: Question): number => {
    if (!question.options || question.options.length === 0) {
      return 0;
    }
    
    if (question.type === 'single') {
      // 单选题：取最高分
      return Math.max(...question.options.map(opt => opt.value || 0));
    } else if (question.type === 'multiple') {
      // 多选题：所有选项分值之和
      return question.options.reduce((sum, opt) => sum + (opt.value || 0), 0);
    }
    
    return 0;
  };

  // 计算维度最大分
  const calculateDimensionMaxScore = (dimensionId: number): number => {
    return questions
      .filter(q => q.dimension_id === dimensionId)
      .reduce((sum, q) => sum + calculateQuestionMaxScore(q), 0);
  };

  // 获取问卷数据
  const fetchQuestionnaireData = async () => {
    try {
      setFetching(true);
      const response = await get<QuestionnaireResponse>(`/api/questionnaire/${id}`);
      if (response.data) {
        setDimensions(response.data.dimensions || []);
        setQuestions(response.data.questions || []);
        setQuestionnaireInfo(response.data);
      }
    } catch (e: any) {
      console.error('Error fetching questionnaire data:', e);
      message.error('获取问卷数据失败');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchQuestionnaireData();
      // 获取问卷列表用于分支规则
      get<{ data: QuestionnaireListItem[] }>('/api/questionnaire/').then(res => {
        if (res.data) {
          setQuestionnaireList(res.data);
        }
      });
    }
  }, [id]);

  // 监听选项变化，更新可选分支规则
  const handleOptionsChange = () => {
    const opts = form.getFieldValue('options') || [];
    setOptions(opts.map((opt: { text: string; value: number; is_other: boolean }, index: number) => ({
      ...opt,
      id: index + 1
    })));
  };

  const handleBranchRuleChange = (idx: number, key: string, value: any) => {
    setBranchRules(rules => {
      const copy = [...rules];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  };

  const addBranchRule = () => setBranchRules(rules => [...rules, { option_id: null, next_questionnaire_id: null }]);
  const removeBranchRule = (idx: number) => setBranchRules(rules => rules.filter((_, i) => i !== idx));

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      const submitData = { 
        ...values,
        options: values.options || [],
        branch_rules: branchRules
      };

      let response;
      if (editingQuestion) {
        // 编辑模式
        response = await put(
          `/api/questionnaire/${id}/question/${editingQuestion.id}`, 
          submitData
        );
      } else {
        // 新增模式
        response = await post(`/api/questionnaire/${id}/add-question`, submitData);
      }

      if (response.msg === 'Success') {
        message.success(editingQuestion ? '编辑题目成功' : '新增题目成功');
        await fetchQuestionnaireData();
        form.resetFields();
        setBranchRules([]);
        setEditingQuestion(null);  // 退出编辑模式
      } else {
        message.error(response.msg || (editingQuestion ? '编辑失败' : '新增失败'));
      }
    } catch (e: any) {
      console.error('Error:', e);
      message.error(e.response?.data?.msg || e.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: number) => {
    try {
      setLoading(true);
      const response = await del(`/api/questionnaire/${id}/question/${questionId}`);
      if (response.msg === 'Success' || response.msg === '删除成功') {
        message.success('删除题目成功');
        await fetchQuestionnaireData();
      } else {
        message.error(response.msg || '删除失败');
      }
    } catch (e: any) {
      console.error('Error deleting question:', e);
      message.error(e.response?.data?.msg || e.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    navigate('/admin/questionnaires');
  };

  const handleMove = async (index: number, direction: number) => {
    if (loading) return;
    const newQuestions = [...questions];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;
    // 交换顺序
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    // 更新 order 字段
    newQuestions.forEach((q, idx) => q.order = idx);
    setQuestions(newQuestions);
    try {
      setLoading(true);
      await post(`/api/questionnaire/${id}/reorder-questions`, {
        orders: newQuestions.map(q => ({ id: q.id, order: q.order }))
      });
      message.success('题目顺序已更新');
      await fetchQuestionnaireData();
    } catch (e) {
      message.error('更新顺序失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    // 设置表单初始值
    form.setFieldsValue({
      text: question.text,
      dimension_id: question.dimension_id,
      type: question.type,
      options: question.options
    });
    // 设置问题类型
    setQuestionType(question.type);
    // 设置选项
    setOptions(question.options);
  };

  return (
    <Card title={`${editingQuestion ? '编辑' : '新增'}题目`}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 维度最大分统计 */}
        {(dimensions.some(dim => questions.some(q => q.dimension_id === dim.id)) || questions.some(q => !q.dimension_id)) && (
          <Card size="small" title="维度分值统计">
            <Space wrap>
              {dimensions
                .filter(dim => questions.some(q => q.dimension_id === dim.id))
                .map(dim => (
                  <Tag key={dim.id} color="blue">
                    {dim.name}: {calculateDimensionMaxScore(dim.id)} 分
                  </Tag>
                ))}
              {questions.filter(q => !q.dimension_id).length > 0 && (
                <Tag color="default">
                  无维度题目: {questions
                    .filter(q => !q.dimension_id)
                    .reduce((sum, q) => sum + calculateQuestionMaxScore(q), 0)} 分
                </Tag>
              )}
              <Tag color="red" style={{ fontWeight: 'bold' }}>
                总计: {questions.reduce((sum, q) => sum + calculateQuestionMaxScore(q), 0)} 分
              </Tag>
            </Space>
          </Card>
        )}

        <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={(changed, all) => {
          handleOptionsChange();
          if (changed.type) setQuestionType(changed.type);
        }}>
          <Form.Item label="题目标题" name="text" rules={[{ required: true, message: '请输入题目标题' }]}>
            <Input maxLength={50} />
          </Form.Item>
          {/* 所有题型都支持维度选择 */}
          <Form.Item label="所属维度" name="dimension_id">
            <Select allowClear placeholder="不选则为无维度" options={dimensions.map(dim => ({ label: dim.name, value: dim.id }))} />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true }]}>
            <Select options={QUESTION_TYPES} onChange={val => setQuestionType(val)} />
          </Form.Item>

          {(questionType === 'single' || questionType === 'multiple') && (
            <>
              <Form.List name="options">
                {(fields, { add, remove }) => (
                  <div>
                    <Button type="dashed" onClick={() => add({})} icon={<PlusOutlined />} disabled={false} style={{}}>添加选项</Button>
                    <div style={{ marginTop: 8 }}>
                      {fields.map((field, index) => (
                        <Space
                          key={field.key}
                          align="baseline"
                          style={{
                            display: 'flex',
                            marginBottom: 12,
                            background: '#fafbfc',
                            borderRadius: 6,
                            padding: '12px 8px',
                            border: '1px solid #f0f0f0'
                          }}
                          wrap
                        >
                          <span style={{ fontWeight: 500, minWidth: 100 }}>{`选项${index + 1}`}</span>
                          <Form.Item
                            {...field}
                            label="内容"
                            name={[field.name, 'text']}
                            rules={[{ required: true, message: '请输入选项内容' }]}
                          >
                            <Input maxLength={50} style={{ width: 300 }} />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            label="分值"
                            name={[field.name, 'value']}
                            extra="可设置：0~1000"
                          >
                            <InputNumber min={0} max={1000} />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            label="支持填写"
                            name={[field.name, 'is_other']}
                            valuePropName="checked"
                          >
                            <Switch
                              onChange={checked => {
                                if (checked) {
                                  const opts = form.getFieldValue('options') || [];
                                  const newOpts = opts.map((opt: { text: string; value: number; is_other: boolean }, idx: number) =>
                                    idx === field.name
                                      ? { ...opt, is_other: true }
                                      : { ...opt, is_other: false }
                                  );
                                  form.setFieldsValue({ options: newOpts });
                                }
                              }}
                            />
                          </Form.Item>
                          <MinusCircleOutlined
                            onClick={() => remove(field.name)}
                            style={{
                              color: 'red',
                              cursor: 'pointer',
                              fontSize: 18,
                              marginLeft: 8
                            }}
                          />
                        </Space>
                      ))}
                    </div>
                  </div>
                )}
              </Form.List>
              {/* 只有父问卷才显示分支规则配置 */}
              {questionnaireInfo && !questionnaireInfo.parent_id && (
                <Collapse 
                  style={{ margin: '16px 0' }} 
                  items={[{
                    key: 'branch',
                    label: '分支规则配置（高级功能）',
                    children: (
                      <Table
                        dataSource={branchRules}
                        rowKey={(_, idx) => String(idx)}
                        pagination={false}
                        columns={[
                          {
                            title: '选项',
                            dataIndex: 'option_id',
                            render: (v, r, idx) => (
                              <Select
                                style={{ width: 180 }}
                                value={v}
                                onChange={val => handleBranchRuleChange(idx, 'option_id', val)}
                                options={options.map((opt: any, i: number) => ({ label: opt.text || `选项${i + 1}`, value: i }))}
                                placeholder="请选择选项"
                              />
                            )
                          },
                          {
                            title: '跳转到问卷',
                            dataIndex: 'next_questionnaire_id',
                            render: (v, r, idx) => (
                              <Select
                                style={{ width: 180 }}
                                value={v}
                                onChange={val => handleBranchRuleChange(idx, 'next_questionnaire_id', val)}
                                options={questionnaireList
                                  .filter(q => 
                                    q.parent_id === Number(id) && 
                                    q.status !== 'deleted'
                                  )
                                  .map(q => ({ label: q.title, value: q.id }))}
                                placeholder="请选择目标问卷"
                              />
                            )
                          },
                          {
                            title: '操作',
                            render: (_, __, idx) => (
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<MinusCircleOutlined />}
                                onClick={() => removeBranchRule(idx)}
                              />
                            )
                          }
                        ]}
                        footer={() => <Button type="dashed" onClick={addBranchRule}>添加分支规则</Button>}
                        style={{ marginBottom: 24 }}
                      />
                    )
                  }]}
                />
              )}
            </>
          )}
          {questionType === 'text' && (
            <Space>
              <Form.Item label="多行输入" name="multiline" valuePropName="checked">
                <Switch onChange={checked => {
                  if (!checked) form.setFieldsValue({ input_rows: 1 });
                }} />
              </Form.Item>
              <Form.Item label="输入框行数" name="input_rows">
                <InputNumber min={1} max={10} disabled={!form.getFieldValue('multiline')} style={!form.getFieldValue('multiline') ? { background: '#f5f5f5', color: '#bbb' } : {}} />
              </Form.Item>
            </Space>
          )}
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingQuestion ? '保存修改' : '保存题目'}
              </Button>
              {editingQuestion && (
                <Button
                  onClick={() => {
                    setEditingQuestion(null);
                    form.resetFields();
                  }}
                  disabled={loading}
                >
                  取消编辑
                </Button>
              )}
              <Button onClick={handleComplete}>返回列表</Button>
            </div>
          </Form.Item>
        </Form>

        <div>
          <Title level={5}>题目列表</Title>
          <List
            bordered
            loading={fetching}
            dataSource={questions}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  index > 0 && (
                    <Button
                      type="text"
                      onClick={() => handleMove(index, -1)}
                      disabled={loading}
                    >
                      上移
                    </Button>
                  ),
                  index < questions.length - 1 && (
                    <Button
                      type="text"
                      onClick={() => handleMove(index, 1)}
                      disabled={loading}
                    >
                      下移
                    </Button>
                  ),
                  <Button 
                    type="link" 
                    onClick={() => handleEdit(item)}
                    loading={loading}
                    disabled={item.branch_rules && item.branch_rules.length > 0}
                    style={item.branch_rules && item.branch_rules.length > 0 ? { color: '#bfbfbf' } : {}}
                    title={item.branch_rules && item.branch_rules.length > 0 ? '此题目已设置分支规则，不允许编辑' : ''}
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    title="确定要删除这个题目吗？"
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
                ].filter(Boolean)}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <span>{index + 1}. {item.text}</span>
                    <span>类型: {QUESTION_TYPES.find(t => t.value === item.type)?.label}</span>
                    {/* 显示题目最大分 */}
                    {(item.type === 'single' || item.type === 'multiple') && (
                      <Tag color="orange">
                        最大分: {calculateQuestionMaxScore(item)}
                      </Tag>
                    )}
                    {item.dimension_id && (
                      <span style={{ fontWeight: 'bold', color: '#2d8cf0', background: '#e6f7ff', borderRadius: 4, padding: '0 6px', marginLeft: 4 }}>
                        维度: {dimensions.find(d => d.id === item.dimension_id)?.name}
                      </span>
                    )}
                    {item.branch_rules && item.branch_rules.length > 0 && (
                      <span style={{ color: '#52c41a', fontSize: '12px' }}>
                        （此题设置了跳转）
                      </span>
                    )}
                  </Space>
                  {item.options && item.options.length > 0 && (
                    <List
                      size="small"
                      dataSource={item.options}
                      renderItem={(opt, optIndex) => {
                        // 查找该选项的分支规则
                        const branchRule = item.branch_rules?.find(br => br.option_id === opt.id);
                        const targetQuestionnaire = branchRule ? questionnaireList.find(q => q.id === branchRule.next_questionnaire_id) : null;
                        
                        return (
                          <List.Item key={opt.id || optIndex} style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ flex: 1 }}>
                              {String.fromCharCode(65 + optIndex)}. {opt.text}
                              {opt.is_other && <span style={{ marginLeft: 8 }}>【支持填写】</span>}
                              {branchRule && targetQuestionnaire && (
                                <span style={{ marginLeft: 8, color: '#1890ff', fontSize: '12px' }}>
                                  跳转到：{targetQuestionnaire.title}
                                </span>
                              )}
                            </span>
                            <span style={{ width: 80, textAlign: 'right' }}>分值: {opt.value}</span>
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </Card>
  );
};

export default AddQuestion;
