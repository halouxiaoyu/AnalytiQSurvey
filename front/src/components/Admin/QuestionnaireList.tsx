/**
 * @author yujinyan
 * @github https://github.com/halouxiaoyu
 * @description 问卷列表管理组件
 */

import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Popconfirm, message, Tag, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined, StopOutlined, CopyOutlined, BarChartOutlined, TeamOutlined, MinusOutlined } from '@ant-design/icons';
import { get, del, post } from '@/utils/request';
import { useNavigate } from 'react-router-dom';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  access_code?: string;
  parent_id?: number;
  children?: Questionnaire[];
}

const QuestionnaireList: React.FC = () => {
  const [data, setData] = useState<Questionnaire[]>([]);
  const [treeData, setTreeData] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 构建树形结构
  function buildTree(data: Questionnaire[]) {
    const map: Record<number, any> = {};
    data.forEach(item => map[Number(item.id)] = { ...item, children: [] });
    const tree: Questionnaire[] = [];
    data.forEach(item => {
      if (item.parent_id) {
        map[Number(item.parent_id)]?.children.push(map[Number(item.id)]);
      } else {
        tree.push(map[Number(item.id)]);
      }
    });
    return tree;
  }

  const fetchList = () => {
    setLoading(true);
    get('/api/questionnaire/')
      .then(res => {
        if (res.code === 0 && Array.isArray(res.data)) {
          const filtered = res.data.filter((q: any) => q.status !== 'deleted');
          console.log('原始data', filtered);
          setData(filtered);
          setTreeData(buildTree(filtered));
        } else {
          setData([]);
          setTreeData([]);
          message.error('加载问卷列表失败');
        }
      })
      .catch(() => {
        setData([]);
        setTreeData([]);
        message.error('加载问卷列表失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await del(`/api/questionnaire/${id}`);
      message.success('删除成功');
      fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  const handleTogglePublish = async (id: number) => {
    try {
      await post(`/api/questionnaire/${id}/toggle-publish`);
      message.success('操作成功');
      fetchList();
    } catch {
      message.error('操作失败');
    }
  };

  // 自动展开所有有子问卷的父问卷（受控模式）
  const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);
  useEffect(() => {
    const keys = treeData
      .filter(q => Array.isArray(q.children) && q.children.length > 0)
      .map(q => q.id);
    setExpandedRowKeys(keys);
  }, [treeData]);

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <span style={{ display: 'flex', alignItems: 'center', marginLeft: record.parent_id ? 16 : 0 }}>
          {text}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'is_published',
      render: (_: boolean, record: any) => record.parent_id ? null : (
        <Tag color={record.is_published ? 'green' : undefined}>{record.is_published ? '已发布' : '草稿'}</Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '问卷链接码',
      dataIndex: 'access_code',
      render: (access_code: string, record: any) =>
        record.parent_id ? null : (
          record.is_published && access_code ? (
            <span>
              <a
                href={`/fill/${access_code}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 'bold', color: '#1890ff' }}
              >
                {access_code}
              </a>
              <Button
                size="small"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/fill/${access_code}`);
                  message.success('链接已复制');
                }}
              >
                复制链接
              </Button>
            </span>
          ) : (
            <span style={{ color: '#aaa' }}>未发布</span>
          )
        ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => {
        // 子问卷数量
        const childCount = record.children ? record.children.length : 0;
        return record.parent_id ? (
          <>
            <Button size="small" icon={<PlusOutlined />} onClick={() => navigate(`/admin/questionnaires/${record.id}/add-question`)}>题目管理</Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/questionnaires/edit/${record.id}`)}>编辑问卷</Button>
          </>
        ) : (
          <>
            {/* 只有子问卷数小于10时才显示新增子问卷按钮 */}
            {childCount < 10 && (
              <Button size="small" type="dashed" onClick={() => navigate(`/admin/questionnaires/create?parent_id=${record.id}`)}>
                新增子问卷
              </Button>
            )}
            <Button size="small" icon={<PlusOutlined />} onClick={() => navigate(`/admin/questionnaires/${record.id}/add-dimension`)}>维度管理</Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => navigate(`/admin/questionnaires/${record.id}/add-question`)}>题目管理</Button>
            <Button size="small" onClick={() => navigate(`/admin/questionnaires/${record.id}/assessment-levels`)}>得分规则配置</Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/questionnaires/edit/${record.id}`)}>编辑问卷</Button>
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
            </Popconfirm>
            <Button size="small" icon={record.is_published ? <StopOutlined /> : <UploadOutlined />} onClick={() => handleTogglePublish(record.id)}>
              {record.is_published ? '下架' : '发布'}
            </Button>
            <Button 
              size="small" 
              type="primary"
              icon={<BarChartOutlined />} 
              style={{ fontWeight: 'bold', borderRadius: 6, background: '#2d8cf0', border: 'none' }}
              onClick={() => navigate(`/admin/questionnaires/stats/${record.id}`)}
            >
              统计图表
            </Button>
            <Button 
              size="small" 
              type="default"
              icon={<TeamOutlined />} 
              style={{ fontWeight: 'bold', borderRadius: 6, color: '#52c41a', border: '1px solid #52c41a', marginLeft: 4 }}
              onClick={() => navigate(`/admin/questionnaires/${record.id}/submissions`)}
            >
              答卷者列表
            </Button>
          </>
        );
      }
    }
  ];

  // 美化展开按钮：圆形背景、蓝色icon、hover高亮
  const customExpandIcon = (props: any) => {
    if (!props.record.children || props.record.children.length === 0) return <span style={{ display: 'inline-block', width: 24 }} />;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#f0f0f0',
          color: '#1890ff',
          fontSize: 16,
          cursor: 'pointer',
          marginRight: 8,
          transition: 'background 0.2s'
        }}
        onClick={e => props.onExpand(props.record, e)}
        onMouseEnter={e => (e.currentTarget.style.background = '#e6f7ff')}
        onMouseLeave={e => (e.currentTarget.style.background = '#f0f0f0')}
      >
        {props.expanded ? <MinusOutlined /> : <PlusOutlined />}
      </span>
    );
  };

  // 打印 treeData 结构
  console.log('treeData', treeData);
  return (
    <Card title="问卷管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/questionnaires/create')}>新建问卷</Button>}>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={treeData}
        loading={loading}
        pagination={{ pageSize: 10 }}
        indentSize={40}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys.map(Number)),
          childrenColumnName: 'children',
          expandIcon: customExpandIcon
        }}
      />
    </Card>
  );
};

export default QuestionnaireList;
