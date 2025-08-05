import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card, Spin, Tag, Row, Col, Progress, Typography, Divider } from 'antd';
import { useParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { get } from '@/utils/request';
import './Result.css';
import { TrophyOutlined, StarFilled, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface Dimension {
  dimension_id: number;
  dimension_name: string;
  score: number;
  max_score: number;
  assessment_level?: string;
  assessment_opinion?: string;
}

interface ResultData {
  questionnaire_title: string;
  total_score: number;
  total_max_score: number;
  assessment_level: string;
  assessment_opinion: string;
  dimensions: Dimension[];
  submitted_at: string;
}

// 级别颜色映射 - 提取为常量避免重复计算
const LEVEL_COLOR_MAP: Record<string, string> = {
  初级: '#f5222d',
  中级: '#faad14', 
  高级: '#52c41a',
  default: '#1890ff'
};

// 获取级别颜色的优化函数
const getLevelColor = (level: string): string => {
  if (!level) return LEVEL_COLOR_MAP.default;
  
  for (const [key, color] of Object.entries(LEVEL_COLOR_MAP)) {
    if (key !== 'default' && level.includes(key)) {
      return color;
    }
  }
  
  return LEVEL_COLOR_MAP.default;
};

// 雷达图配置生成器 - 使用useMemo缓存
const createRadarOption = (dimensions: Dimension[]) => {
  const radarDimensions = dimensions.map(d => ({
    name: d.dimension_name,
    max: d.max_score,
  }));
  const scores = dimensions.map(d => d.score);

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}分',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#1890ff',
      borderWidth: 1,
      textStyle: {
        color: '#333',
        fontSize: 14
      },
      padding: [8, 12]
    },
    radar: {
      indicator: radarDimensions,
      radius: '70%',
      splitNumber: 4,
      shape: 'circle',
      axisName: {
        color: '#666',
        fontSize: 14,
        fontWeight: 500,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 6,
        padding: [3, 8],
      },
      splitLine: {
        lineStyle: {
          color: ['#e8e8e8'],
          width: 1.5,
        },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(24,144,255,0.04)', 'rgba(24,144,255,0.01)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8',
          width: 1.5,
        },
      },
    },
    series: [
      {
        name: '维度得分',
        type: 'radar',
        data: [
          {
            value: scores,
            name: '得分',
            areaStyle: {
              color: 'rgba(24,144,255,0.3)',
            },
            lineStyle: {
              color: '#1890ff',
              width: 3,
            },
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: {
              color: '#1890ff',
              borderColor: '#fff',
              borderWidth: 2,
            },
          },
        ],
      },
    ],
    animation: true,
    animationDuration: 1200,
    animationEasing: 'cubicOut'
  };
};

// 条形图配置生成器 - 使用useMemo缓存
const createBarOption = (dimensions: Dimension[], globalMaxScore: number) => {
  const scores = dimensions.map(d => d.score);
  
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: function(params: any) {
        const data = params[0];
        const dimension = dimensions[data.dataIndex];
        return `${data.name}<br/>得分：${data.value}/${dimension.max_score}分`;
      }
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      max: globalMaxScore,
      axisLabel: {
        color: '#666',
        fontSize: 11
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8'
        }
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0'
        }
      }
    },
    yAxis: {
      type: 'category',
      data: dimensions.map(d => d.dimension_name),
      axisLabel: {
        color: '#333',
        fontSize: 12,
        fontWeight: 500,
        width: 80,
        overflow: 'truncate'
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8'
        }
      }
    },
    series: [
      {
        name: '得分',
        type: 'bar',
        data: scores.map((score, index) => ({
          value: score,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#1890ff' },
              { offset: 1, color: '#40a9ff' }
            ])
          }
        })),
        itemStyle: {
          borderRadius: [0, 3, 3, 0]
        },
        barWidth: '70%',
        label: {
          show: true,
          position: 'right',
          color: '#333',
          fontSize: 11,
          fontWeight: 500,
          distance: 4,
          formatter: function(params: any) {
            const dimension = dimensions[params.dataIndex];
            return `${params.value}/${dimension.max_score}`;
          }
        }
      }
    ],
    animation: true,
    animationDuration: 1000
  };
};

// 维度分析项组件
const DimensionItem = React.memo<{
  dimension: Dimension;
  isMobile: boolean;
}>(({ dimension, isMobile }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ 
      padding: isMobile ? 10 : 14, 
      backgroundColor: '#f8f9fa', 
      borderRadius: 6,
      borderLeft: '3px solid #1890ff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong style={{ fontSize: isMobile ? 13 : 15, color: '#333', flex: 1, marginRight: 8 }}>
          {dimension.dimension_name}
        </Text>
        <Text strong style={{ fontSize: isMobile ? 14 : 16, color: '#1890ff', whiteSpace: 'nowrap' }}>
          {dimension.score}
          <span style={{ fontSize: isMobile ? 12 : 14, color: '#999', fontWeight: 'normal' }}>
            /{dimension.max_score}
          </span>
          分
        </Text>
      </div>
      <Progress 
        percent={Math.round((dimension.score / dimension.max_score) * 100)} 
        showInfo={false}
        strokeColor="#1890ff"
        style={{ marginBottom: 8 }}
        size={isMobile ? 'small' : 'default'}
      />
      {dimension.assessment_level && (
        <Tag 
          color={getLevelColor(dimension.assessment_level)}
          style={{ fontSize: isMobile ? 12 : 13, borderRadius: 10, marginBottom: 8 }}
        >
          {dimension.assessment_level}
        </Tag>
      )}
      {dimension.assessment_opinion && (
        <Text style={{ 
          fontSize: isMobile ? 12 : 15, 
          color: '#444', 
          lineHeight: 1.7,
          marginTop: 6,
          display: 'block',
          wordBreak: 'break-all'
        }}>
          {dimension.assessment_opinion}
        </Text>
      )}
    </div>
  </div>
));

const Result: React.FC = () => {
  const { submission_id } = useParams<{ submission_id: string }>();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 用于防止内存泄漏和重复请求
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestCacheRef = useRef<Map<string, Promise<any>>>(new Map());
  const isUnmountedRef = useRef(false);

  // 清理函数
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      requestCacheRef.current.clear();
    };
  }, []);

  // 请求去重装饰器
  const withRequestDeduplication = useCallback(<T,>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    const cache = requestCacheRef.current;
    
    if (cache.has(key)) {
      return cache.get(key) as Promise<T>;
    }
    
    const promise = requestFn()
      .finally(() => {
        cache.delete(key);
      });
    
    cache.set(key, promise);
    return promise;
  }, []);

  useEffect(() => {
    if (submission_id) {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const requestKey = `result-${submission_id}`;
      
      withRequestDeduplication(requestKey, () =>
        get<ResultData>(`/api/questionnaire/fill/result/${submission_id}`, {
          signal: abortControllerRef.current?.signal
        })
      ).then(res => {
        if (isUnmountedRef.current) return;
        setData(res.data);
        setLoading(false);
      }).catch(error => {
        if (isUnmountedRef.current || error.name === 'AbortError') return;
        
        console.error('Load result failed:', error);
        if (error.response?.status === 404) {
          console.error('Result not found');
        } else {
          console.error('Load result failed, please retry');
        }
        setLoading(false);
      });
    }
  }, [submission_id, withRequestDeduplication]);

  if (loading) return <Spin style={{ margin: 40 }} />;
  if (!data) return <div>未找到评估结果</div>;

  return <ResultContent data={data} />;
};

export const ResultContent: React.FC<{ data: ResultData }> = React.memo(({ data }) => {
  // 使用后端返回的维度数据，后端已经过滤了只包含有答案的维度
  const dimensions = data?.dimensions || [];

  // 缓存计算结果
  const computedValues = useMemo(() => {
    const globalMaxScore = Math.max(...dimensions.map(d => d.max_score), 100);
    const isMobile = window.innerWidth <= 600;
    
    return {
      globalMaxScore,
      isMobile,
      radarOption: createRadarOption(dimensions),
      barOption: createBarOption(dimensions, globalMaxScore)
    };
  }, [dimensions]);

  const { globalMaxScore, isMobile, radarOption, barOption } = computedValues;

  return (
    <div className={isMobile ? 'result-page mobile' : 'result-page'}>
      <div className={isMobile ? 'result-header mobile' : 'result-header'}>
        <Title level={isMobile ? 4 : 2} style={{ margin: 0, color: '#fff', fontSize: isMobile ? 20 : undefined }}>
          <TrophyOutlined style={{ marginRight: 8 }} />
          {data?.questionnaire_title}总结报告
        </Title>
        <Text style={{ fontSize: isMobile ? 12 : 14, color: 'rgba(255, 255, 255, 0.8)' }}>
          提交时间：{new Date(data?.submitted_at || '').toLocaleString()}
        </Text>
      </div>

      {/* 雷达图 */}
      <Card className={isMobile ? 'result-radar-card mobile' : 'result-radar-card'} style={{ marginBottom: 24, borderRadius: isMobile ? 10 : 16 }}>
        <Title level={isMobile ? 5 : 4} style={{ marginBottom: 16, color: '#1890ff', fontSize: isMobile ? 16 : undefined }}>
          <StarFilled style={{ marginRight: 8, color: '#1890ff' }} />
          维度能力雷达图
        </Title>
        <ReactECharts option={radarOption} style={{ height: isMobile ? 260 : 400, width: '100%' }} />
      </Card>

      {/* 总结报告 */}
      <Card className={isMobile ? 'result-summary-card mobile' : 'result-summary-card'} style={{ marginBottom: 24, borderRadius: isMobile ? 10 : 16 }}>
        <Title level={isMobile ? 5 : 4} style={{ marginBottom: 20, color: '#1890ff', fontSize: isMobile ? 16 : undefined }}>
          <CheckCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          总结陈述
        </Title>
        <Row gutter={[isMobile ? 8 : 24, isMobile ? 8 : 24]}>
          <Col xs={24} sm={24} md={8}>
            <div style={{ textAlign: 'center', padding: isMobile ? '10px 0' : '20px 0' }}>
              <div style={{ fontSize: isMobile ? 32 : 48, fontWeight: 'bold', color: '#1890ff', marginBottom: 8 }}>
                {data?.total_score}
                <span style={{ fontSize: isMobile ? 16 : 24, color: '#999', fontWeight: 'normal' }}>
                  /{data?.total_max_score}
                </span>
              </div>
              <Text style={{ fontSize: isMobile ? 13 : 16, color: '#666' }}>总分</Text>
            </div>
          </Col>
          <Col xs={24} sm={24} md={16}>
            <div style={{ padding: isMobile ? '10px 0' : '20px 0' }}>
              {data?.assessment_level && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: isMobile ? 14 : 16, marginRight: 12, color: '#333' }}>评估级别：</Text>
                  <Tag 
                    color={getLevelColor(data.assessment_level)} 
                    style={{ fontSize: isMobile ? 14 : 16, padding: isMobile ? '4px 10px' : '6px 16px', borderRadius: 20 }}
                  >
                    {data.assessment_level}
                  </Tag>
                </div>
              )}
              {data?.assessment_opinion && (
                <div>
                  <Text strong style={{ fontSize: isMobile ? 14 : 16, marginRight: 12, color: '#333' }}>评估意见：</Text>
                  <Text style={{ fontSize: isMobile ? 12 : 14, color: '#666', lineHeight: 1.6 }}>
                    {data.assessment_opinion}
                  </Text>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 维度详细得分 */}
      <Card className={isMobile ? 'result-dimensions-card mobile' : 'result-dimensions-card'} style={{ borderRadius: isMobile ? 10 : 16 }}>
        <Title level={isMobile ? 5 : 4} style={{ marginBottom: 20, color: '#1890ff', fontSize: isMobile ? 16 : undefined }}>
          <InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          维度详细分析
        </Title>
        <div style={{ maxHeight: isMobile ? 320 : 500, overflowY: 'auto', paddingRight: 8 }}>
          {dimensions.map((dimension) => (
            <DimensionItem
              key={dimension.dimension_id}
              dimension={dimension}
              isMobile={isMobile}
            />
          ))}
        </div>
      </Card>
    </div>
  );
});

export default Result;
