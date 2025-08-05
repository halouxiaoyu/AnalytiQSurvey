/**
 * @author yujinyan
 * @github https://github.com/halouxiaoyu
 * @description 评估等级配置组件
 */

import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, message, Space, Popconfirm, Select, Radio } from 'antd';
import { useParams } from 'react-router-dom';
import { get, post, del } from '@/utils/request';

interface Dimension {
  id: number;
  name: string;
}

interface BasicGroup {
  group_key: string;
  label: string;
}

interface AssessmentLevel {
  id: number;
  min_score: number;
  max_score: number;
  name: string;
  opinion: string;
  group_key?: string;
  dimension_id?: number;
}

const AssessmentLevelConfig: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [levels, setLevels] = useState<AssessmentLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<AssessmentLevel | null>(null);
  const [form] = Form.useForm();
  const [basicGroups, setBasicGroups] = useState<BasicGroup[]>([]);
  const [groupKey, setGroupKey] = useState<string | undefined>(undefined);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [configType, setConfigType] = useState<'total' | 'dimension'>('total');
  const [scoreOverlapError, setScoreOverlapError] = useState<string>('');
  const [dimensionWeights, setDimensionWeights] = useState<Record<number, number>>({});
  const [dimensionFilter, setDimensionFilter] = useState<string | number | undefined>('');

  // 获取评估等级列表
  const fetchLevels = async (groupKeyParam?: string) => {
    try {
      setLoading(true);
      const res = await get<AssessmentLevel[]>(`/api/questionnaire/${id}/assessment-levels`, 
        groupKeyParam ? { group_key: groupKeyParam } : {});
      if (res && Array.isArray(res.data)) {
        setLevels(res.data);
      } else {
        setLevels([]);
        message.warning('获取评估等级列表为空');
      }
    } catch (error) {
      console.error('获取评估等级列表失败:', error);
      message.error('获取评估等级列表失败');
      setLevels([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取基本信息分组
  const fetchBasicGroups = async () => {
    try {
      // 直接使用后端提供的分组API，确保前后端一致
      const res = await get(`/api/questionnaire/${id}/basic-groups`);
      const groups = Array.isArray(res.data) ? res.data : [];
      setBasicGroups(groups);
    } catch (error) {
      console.error('获取基本信息分组失败:', error);
      message.error('获取基本信息分组失败');
    }
  };

  // 获取维度列表
  const fetchDimensions = async () => {
    try {
      const res = await get(`/api/questionnaire/${id}`);
      const detailData: any = res.data || {};
      const dims = Array.isArray(detailData.dimensions) ? detailData.dimensions : [];
      // 过滤掉"用户基本信息(不参与得分评估)"维度
      setDimensions(dims.filter((d: any) => d.name !== '用户基本信息(不参与得分评估)'));
    } catch (error) {
      console.error('获取维度列表失败:', error);
      message.error('获取维度列表失败');
    }
  };

  useEffect(() => { 
    if (id) {
      fetchLevels(groupKey);
      fetchBasicGroups();
      fetchDimensions();
      // 拉取问卷详情，获取维度权重
      get(`/api/questionnaire/${id}`).then(res => {
        const dims = (res.data as any)?.dimensions || [];
        const weightMap: Record<number, number> = {};
        dims.forEach((d: any) => {
          weightMap[d.id] = typeof d.weight === 'number' ? d.weight : 1;
        });
        setDimensionWeights(weightMap);
      });
    }
  }, [id, groupKey]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setConfigType('total');
    setScoreOverlapError(''); // 清除错误状态
    form.setFieldsValue({ modal_group_key: groupKey });
    setModalVisible(true);
  };

  const handleEdit = (record: AssessmentLevel) => {
    setEditing(record);
    setConfigType(record.dimension_id ? 'dimension' : 'total');
    setScoreOverlapError(''); // 清除错误状态
    form.setFieldsValue({ 
      ...record, 
      modal_group_key: record.group_key,
      configType: record.dimension_id ? 'dimension' : 'total'
    });
    setModalVisible(true);
  };

  const handleDelete = async (levelId: number) => {
    try {
      await del(`/api/questionnaire/${id}/assessment-levels/${levelId}`);
      message.success('删除成功');
      fetchLevels(groupKey);
    } catch (error) {
      console.error('删除评估等级失败:', error);
      if (error instanceof Error) {
        message.error(error.message || '删除失败');
      } else {
        message.error('删除失败，请稍后重试');
      }
    }
  };

  // 检查分数重叠
  const checkScoreOverlap = (minScore: number, maxScore: number, currentId?: number): boolean => {
    // 检查分数范围是否有效 - 允许下限等于上限
    if (minScore > maxScore) {
      message.error('分数下限不能大于分数上限');
      return true; // 返回true表示有错误
    }

    // 获取当前分组和维度的所有评估等级
    const currentGroupKey = form.getFieldValue('modal_group_key');
    const currentDimensionId = configType === 'dimension' ? form.getFieldValue('dimension_id') : undefined;
    
    const existingLevels = levels.filter(level => {
      // 排除当前正在编辑的记录
      if (currentId && level.id === currentId) {
        return false;
      }
      
      // 检查分组和维度是否匹配
      if (configType === 'dimension') {
        return level.group_key === currentGroupKey && level.dimension_id === currentDimensionId;
      } else {
        return level.group_key === currentGroupKey && !level.dimension_id;
      }
    });

    // 检查是否有重叠
    for (const level of existingLevels) {
      // 检查两个区间是否重叠
      // 重叠条件：新规则的下限 <= 现有规则的上限 且 新规则的上限 >= 现有规则的下限
      // 这样可以检测到边界重叠，如 [0,60] 和 [60,70] 的重叠
      if (minScore <= level.max_score && maxScore >= level.min_score) {
        message.error(`分数范围与现有规则"${level.name}"(${level.min_score}-${level.max_score})重叠，请调整分数范围`);
        return true; // 返回true表示有重叠
      }
    }

    return false; // 返回false表示没有重叠
  };

  // 实时检查分数重叠
  const checkScoreOverlapRealTime = (minScore?: number, maxScore?: number) => {
    if (!minScore || !maxScore) {
      setScoreOverlapError('');
      return;
    }

    // 检查分数范围是否有效 - 允许下限等于上限
    if (minScore > maxScore) {
      setScoreOverlapError('分数下限不能大于分数上限');
      return;
    }

    // 获取当前分组和维度的所有评估等级
    const currentGroupKey = form.getFieldValue('modal_group_key');
    const currentDimensionId = configType === 'dimension' ? form.getFieldValue('dimension_id') : undefined;
    
    if (!currentGroupKey) {
      setScoreOverlapError('');
      return;
    }
    
    const existingLevels = levels.filter(level => {
      // 排除当前正在编辑的记录
      if (editing?.id && level.id === editing.id) {
        return false;
      }
      
      // 检查分组和维度是否匹配
      if (configType === 'dimension') {
        return level.group_key === currentGroupKey && level.dimension_id === currentDimensionId;
      } else {
        return level.group_key === currentGroupKey && !level.dimension_id;
      }
    });

    // 检查是否有重叠
    for (const level of existingLevels) {
      // 检查两个区间是否重叠
      // 重叠条件：新规则的下限 <= 现有规则的上限 且 新规则的上限 >= 现有规则的下限
      // 这样可以检测到边界重叠，如 [0,60] 和 [60,70] 的重叠
      if (minScore <= level.max_score && maxScore >= level.min_score) {
        setScoreOverlapError(`分数范围与现有规则"${level.name}"(${level.min_score}-${level.max_score})重叠`);
        return;
      }
    }

    setScoreOverlapError('');
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      // 检查分数重叠
      if (checkScoreOverlap(values.min_score, values.max_score, editing?.id)) {
        return; // 如果有重叠，直接返回，不继续执行
      }
      
      await post(`/api/questionnaire/${id}/assessment-levels`, { 
        ...values, 
        id: editing?.id, 
        group_key: values.modal_group_key,
        dimension_id: configType === 'dimension' ? values.dimension_id : undefined
      });
      setModalVisible(false);
      message.success('保存成功');
      setGroupKey(undefined);
      fetchLevels();
    } catch (error) {
      console.error('保存评估等级失败:', error);
      if (error instanceof Error) {
        message.error(error.message || '保存失败');
      } else {
        message.error('保存失败，请检查表单数据');
      }
    }
  };

  const columns = [
    { 
      title: '分组',
      dataIndex: 'group_key',
      key: 'group_key',
      render: (groupKey: string) => {
        const group = basicGroups.find(g => g.group_key === groupKey);
        return group ? group.label : '-';
      }
    },
    {
      title: '维度',
      dataIndex: 'dimension_id',
      key: 'dimension_id',
      render: (dimensionId: number) => {
        const dimension = dimensions.find(d => d.id === dimensionId);
        return dimension ? dimension.name : '-';
      }
    },
    { title: '分数下限', dataIndex: 'min_score', key: 'min_score' },
    { title: '分数上限', dataIndex: 'max_score', key: 'max_score' },
    { title: '级别', dataIndex: 'name', key: 'name' },
    {
      title: '评估意见',
      dataIndex: 'opinion',
      key: 'opinion',
      render: (text: string) => (
        <div
          style={{
            maxWidth: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={text}
        >
          {text}
        </div>
      )
    },
    {
      title: '操作',
      render: (_: any, record: AssessmentLevel) => (
        <Space>
          <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 规则列表按添加时间倒序（id越大越新）排序，并按维度过滤
  const filteredLevels = [...levels]
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .filter(level => {
      if (dimensionFilter === 'none') {
        return !level.dimension_id;
      }
      if (dimensionFilter && level.dimension_id !== Number(dimensionFilter)) return false;
      return true;
    });

  return (
    <Card title="得分规则配置" extra={<Button type="primary" onClick={handleAdd}>新增规则</Button>}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <span style={{ marginRight: 8 }}>分组：</span>
          <Select
            style={{ width: 260 }}
            value={groupKey || null}
            onChange={(value) => setGroupKey(value || undefined)}
            options={[
              { label: '全部分组', value: '' },
              ...basicGroups.map(g => ({ label: g.label, value: g.group_key }))
            ]}
            placeholder="请选择分组"
          />
        </div>
        <div>
          <span style={{ marginRight: 8 }}>维度：</span>
          <Select
            style={{ width: 200 }}
            value={dimensionFilter}
            onChange={setDimensionFilter}
            options={[
              { label: '全部维度', value: '' },
              { label: '无维度', value: 'none' },
              ...dimensions.map(d => ({ label: d.name, value: d.id }))
            ]}
            placeholder="请选择维度"
            allowClear
          />
        </div>
      </div>
      <Table 
        rowKey="id" 
        columns={columns} 
        dataSource={filteredLevels} 
        loading={loading} 
        pagination={{ 
          pageSize: 10, 
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          pageSizeOptions: ['10', '20', '50'],
          showQuickJumper: true
        }} 
      />
      <Modal
        title={editing ? '编辑规则' : '新增规则'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="配置类型"
            required
            extra={
              <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
                <div><strong>总分配置：</strong>设置问卷整体评估等级，影响结果页面的总分显示和总结陈述</div>
                <div><strong>维度配置：</strong>设置单个维度的评估等级，影响结果页面的维度详细分析和雷达图显示</div>
              </div>
            }
          >
            <Radio.Group
              value={configType}
              onChange={e => {
                setConfigType(e.target.value);
                setScoreOverlapError(''); // 清除错误状态
                // 延迟检查，确保表单值已更新
                setTimeout(() => {
                  const minScore = form.getFieldValue('min_score');
                  const maxScore = form.getFieldValue('max_score');
                  checkScoreOverlapRealTime(minScore || undefined, maxScore || undefined);
                }, 100);
              }}
            >
              <Radio value="total">总分配置</Radio>
              <Radio value="dimension">维度配置</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="modal_group_key"
            label="分组"
            rules={[{ required: true, message: '请选择分组' }]}
          >
            <Select
              options={basicGroups.map(g => ({ label: g.label, value: g.group_key }))}
              placeholder="请选择分组"
              showSearch
              optionFilterProp="label"
              onChange={() => {
                const minScore = form.getFieldValue('min_score');
                const maxScore = form.getFieldValue('max_score');
                checkScoreOverlapRealTime(minScore || undefined, maxScore || undefined);
              }}
            />
          </Form.Item>
          {configType === 'dimension' && (
            <Form.Item
              name="dimension_id"
              label="维度"
              rules={[{ required: true, message: '请选择维度' }]}
            >
              <Select
                options={dimensions.map(d => ({ label: d.name, value: d.id }))}
                placeholder="请选择维度"
                onChange={() => {
                  const minScore = form.getFieldValue('min_score');
                  const maxScore = form.getFieldValue('max_score');
                  checkScoreOverlapRealTime(minScore || undefined, maxScore || undefined);
                }}
              />
            </Form.Item>
          )}
          <Form.Item
            name="min_score"
            label="分数下限"
            rules={[{ required: true, type: 'number', message: '请输入分数下限' }]}
          >
            <InputNumber 
              min={0} 
              max={1000} 
              step={0.01} 
              style={{ width: '100%' }} 
              onChange={(value) => {
                const maxScore = form.getFieldValue('max_score');
                checkScoreOverlapRealTime(value || undefined, maxScore || undefined);
              }}
            />
          </Form.Item>
          <Form.Item
            name="max_score"
            label="分数上限"
            rules={[{ required: true, type: 'number', message: '请输入分数上限' }]}
            extra={
              <div style={{ color: '#1890ff', fontSize: '12px' }}>
                <strong>重要提示：</strong>分数上限会影响结果页面的显示效果，系统会取该维度/总分所有配置中的最大值作为图表的满分基准
              </div>
            }
          >
            <InputNumber 
              min={0} 
              max={1000} 
              step={0.01} 
              style={{ width: '100%' }} 
              onChange={(value) => {
                const minScore = form.getFieldValue('min_score');
                checkScoreOverlapRealTime(minScore || undefined, value || undefined);
              }}
            />
          </Form.Item>
          {scoreOverlapError && (
            <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '-8px', marginBottom: '8px' }}>
              {scoreOverlapError}
            </div>
          )}
          <Form.Item
            name="name"
            label="级别"
            rules={[
              { required: true, message: '请输入级别' },
              { max: 50, message: '最多50个字' }
            ]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item
            name="opinion"
            label="评估意见"
            rules={[
              { required: true, message: '请输入评估意见' },
              { max: 400, message: '最多400个字' }
            ]}
          >
            <Input.TextArea rows={3} maxLength={400} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AssessmentLevelConfig;
