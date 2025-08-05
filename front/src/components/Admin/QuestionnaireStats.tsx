import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Button, message, Spin, Select, Row, Col } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { get } from '../../utils/request';
import { useParams } from 'react-router-dom';
import { Radar } from '@ant-design/plots';
import ReactECharts from 'echarts-for-react';
import areaOptions from '../Questionnaire/areaOptions';
import { 
  useUnmountProtection, 
  useAbortController, 
  globalRequestCache,
  useDebounce,
  withRetry
} from '@/utils/performance';

const { Title } = Typography;

interface DimensionScore {
  dimension_id: number;
  dimension_name: string;
  avg_score: number;
}

interface LevelStat {
  level: string;
  count: number;
}

interface BasicQuestion {
  id: number;
  text: string;
  type: string;
}

interface LevelByBasic {
  level: string;
  option: string;
  count: number;
}

interface StatsData {
  total_submissions: number;
  dimension_scores: DimensionScore[];
  raw_answers: any[];
  area_stats: Record<string, number>;
  address_questions: { id: number; text: string }[];
  area_stats_raw: any[];
  area_level_stats_raw: any[];
}

function getAreaNameByCodes(codes: string[] | number[]): string {
  let result: string[] = [];
  let options = areaOptions;
  for (const code of codes) {
    const found = options.find(opt => String(opt.value) === String(code));
    if (!found) break;
    result.push(found.label);
    options = found.children || [];
  }
  return result.join('/');
}

const QuestionnaireStats: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [levelStats, setLevelStats] = useState<LevelStat[]>([]);
  const [basicQuestions, setBasicQuestions] = useState<BasicQuestion[]>([]);
  const [selectedBasicQ, setSelectedBasicQ] = useState<number | null>(null);
  const [levelByBasic, setLevelByBasic] = useState<LevelByBasic[]>([]);
  const [selectedAddressQ, setSelectedAddressQ] = useState<number | undefined>(undefined);
  const [areaLevel, setAreaLevel] = useState<'province' | 'city' | 'district'>('province');
  const [addressQuestions, setAddressQuestions] = useState<{ id: number; text: string }[]>([]);
  const [areaStatsRaw, setAreaStatsRaw] = useState<any[]>([]);
  const [areaLevelStatsRaw, setAreaLevelStatsRaw] = useState<any[]>([]);
  const [dimensionWeights, setDimensionWeights] = useState<Record<number, number>>({});

  const isUnmountedRef = useUnmountProtection();
  const { getController } = useAbortController();

  const fetchWithRetry = React.useMemo(() => 
    withRetry(get, 2, 1000), 
    []
  );

  const debouncedHandleBasicQChange = useDebounce((value: number) => {
    setSelectedBasicQ(value);
  }, 300);

  React.useEffect(() => {
    if (id) {
      const controller = getController();
      setLoading(true);
      
      Promise.all([
        globalRequestCache.withDeduplication(
          `stats-overview-${id}`,
          () => fetchWithRetry(`/api/stats/questionnaire/${id}/overview`, { signal: controller.signal })
        ),
        globalRequestCache.withDeduplication(
          `level-stats-${id}`,
          () => fetchWithRetry(`/api/stats/questionnaire/${id}/level-stats`, { signal: controller.signal })
        ),
        globalRequestCache.withDeduplication(
          `basic-questions-${id}`,
          () => fetchWithRetry(`/api/stats/questionnaire/${id}/all-basic-questions`, { signal: controller.signal })
        ),
        globalRequestCache.withDeduplication(
          `questionnaire-${id}`,
          () => fetchWithRetry(`/api/questionnaire/${id}`, { signal: controller.signal })
        )
      ]).then(([overviewRes, levelRes, basicRes, questionnaireRes]) => {
        if (isUnmountedRef.current) return;
        
        const overviewData = (overviewRes as any).data;
        const levelData = (levelRes as any).data;
        const basicData = (basicRes as any).data;
        const questionnaireData = (questionnaireRes as any).data;
        
        setStats(overviewData);
        setAddressQuestions(overviewData?.address_questions || []);
        setAreaStatsRaw(overviewData?.area_stats_raw || []);
        setAreaLevelStatsRaw(overviewData?.area_level_stats_raw || []);
        
        if ((overviewData?.address_questions || []).length > 0) {
          setSelectedAddressQ(overviewData.address_questions[0].id);
        }
        
        setLevelStats(levelData || []);
        setBasicQuestions((basicData || []).filter((q: any) => q.type === 'single'));
        
        const dims = (questionnaireData?.dimensions || []);
        const weightMap: Record<number, number> = {};
        dims.forEach((d: any) => {
          weightMap[d.id] = typeof d.weight === 'number' ? d.weight : 1;
        });
        setDimensionWeights(weightMap);
      })
      .catch((error) => {
        if (isUnmountedRef.current || error.name === 'AbortError') return;
        message.error('加载统计数据失败');
      })
      .finally(() => {
        if (!isUnmountedRef.current) {
          setLoading(false);
        }
      });
    }
  }, [id, fetchWithRetry, getController, isUnmountedRef]);

  React.useEffect(() => {
    if (id && selectedBasicQ) {
      const controller = getController();
      
      globalRequestCache.withDeduplication(
        `level-by-basic-${id}-${selectedBasicQ}`,
        () => fetchWithRetry(`/api/stats/questionnaire/${id}/level-by-basic/${selectedBasicQ}`, { signal: controller.signal })
      ).then(res => {
        if (!isUnmountedRef.current) {
          setLevelByBasic((res as any).data || []);
        }
      }).catch((error) => {
        if (isUnmountedRef.current || error.name === 'AbortError') return;
        console.error('Failed to fetch level by basic:', error);
      });
    }
  }, [id, selectedBasicQ, fetchWithRetry, getController, isUnmountedRef]);

  // 饼图 option
  const pieOption = {
    title: { text: '评估等级分布', left: 'center' },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '人数',
        type: 'pie',
        radius: '50%',
        data: levelStats
          .filter(item => item.level)
          .map(item => ({ name: item.level, value: item.count })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
        label: {
          show: true,
          formatter: '{b}: {c} ({d}%)'
        }
      }
    ]
  };

  // 柱状图 option (堆叠样式)
  let barOption = undefined;
  if (levelByBasic.length > 0) {
    const levels = Array.from(new Set(levelByBasic.map(i => i.level)));
    const options = Array.from(new Set(levelByBasic.map(i => i.option)));
    barOption = {
      tooltip: { trigger: 'axis' },
      legend: { data: levels },
      xAxis: { type: 'category', data: options },
      yAxis: { type: 'value' },
      series: levels.map(level => ({
        name: level,
        type: 'bar',
        stack: 'total', // 添加堆叠标识
        data: options.map(opt => {
          const found = levelByBasic.find(item => item.level === level && item.option === opt);
          return found ? found.count : 0;
        }),
        emphasis: { focus: 'series' } // 添加强调效果
      }))
    };
  }

  // 雷达图数据和样式（采用 Result.tsx 风格）
  // 过滤掉"用户基本信息"维度（保险起见）
  const filteredDimensions = (stats?.dimension_scores || []).filter(d => d.dimension_name !== '用户基本信息(不参与得分评估)');
  const maxScore = 20; // 可根据实际最大分调整
  const dimensions = filteredDimensions.map(d => ({
    name: d.dimension_name,
    max: maxScore,
  }));
  const scores = filteredDimensions.map(d => d.avg_score);

  const radarOption = {
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
    grid: {
      left: '10%',
      right: '10%',
      top: '15%',
      bottom: '15%'
    },
    radar: {
      indicator: dimensions,
      radius: '65%', // 稍微缩小半径，给轴标签留更多空间
      center: ['50%', '50%'], // 确保居中
      splitNumber: 4,
      shape: 'polygon', // 改为多边形，通常比圆形更清晰
      axisName: {
        color: '#333',
        fontSize: 13,
        fontWeight: 500,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 4,
        padding: [4, 8],
        rich: {
          // 支持富文本格式，可以换行显示长文本
          name: {
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 16
          }
        }
      },
      axisNameGap: 20, // 增加轴名称与轴线的距离
      splitLine: {
        lineStyle: {
          color: '#e8e8e8',
          width: 1,
          type: 'solid'
        },
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: [
            'rgba(24,144,255,0.05)', 
            'rgba(24,144,255,0.02)', 
            'rgba(24,144,255,0.01)',
            'transparent'
          ],
        },
      },
      axisLine: {
        lineStyle: {
          color: '#d9d9d9',
          width: 1,
        },
      },
      axisTick: {
        show: false // 隐藏刻度线，让图表更简洁
      }
    },
    series: [
      {
        name: '维度平均分',
        type: 'radar',
        data: [
          {
            value: scores,
            name: '平均分',
            areaStyle: {
              color: 'rgba(24,144,255,0.2)', // 使用更柔和的蓝色
            },
            lineStyle: {
              color: '#1890ff',
              width: 3,
            },
            symbol: 'circle',
            symbolSize: 8, // 稍微缩小点的大小
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
    animationDuration: 1000,
    animationEasing: 'cubicOut'
  };

  // 区域 × 评估等级 聚合
  function aggregateAreaLevelStats(raw: any[], questionId: number | undefined, level: 'province' | 'city' | 'district') {
    if (!questionId) return { areaList: [], levelList: [], data: [] };
    const filtered = raw.filter(item => Number(item.question_id) === Number(questionId) && item.level);
    // 统计所有出现过的等级
    const levelSet = new Set(filtered.map(item => item.level));
    const levelList = Array.from(levelSet);
    // 统计所有区域
    const areaMap: Record<string, Record<string, number>> = {};
    filtered.forEach(item => {
      let key = '';
      if (level === 'province') key = item.area[0];
      else if (level === 'city') key = item.area.slice(0, 2).join('/');
      else if (level === 'district') key = item.area.slice(0, 3).join('/');
      if (!key) return;
      if (!areaMap[key]) areaMap[key] = {};
      areaMap[key][item.level] = (areaMap[key][item.level] || 0) + 1;
    });
    const areaList = Object.keys(areaMap);
    // 生成表格和图表数据
    const data = areaList.map(area => {
      const row: any = { area, areaName: getAreaNameByCodes(area.split('/')) };
      levelList.forEach(lv => {
        row[lv] = areaMap[area][lv] || 0;
      });
      return row;
    });
    return { areaList, levelList, data };
  }

  // 区域 × 评估等级 聚合结果
  const areaLevelAgg = aggregateAreaLevelStats(areaLevelStatsRaw, selectedAddressQ, areaLevel);

  // 调试用：打印数据
  console.log('areaLevelStatsRaw', areaLevelStatsRaw);
  console.log('areaLevelAgg', areaLevelAgg);
  console.log('selectedAddressQ', selectedAddressQ, typeof selectedAddressQ);

  // 区域 × 评估等级 堆叠柱状图 option
  const areaLevelBarOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: areaLevelAgg.levelList },
    xAxis: { type: 'category', data: areaLevelAgg.data.map(i => i.areaName) },
    yAxis: { type: 'value' },
    series: areaLevelAgg.levelList.map((lv: string) => ({
      name: lv,
      type: 'bar',
      stack: 'total',
      data: areaLevelAgg.data.map((i: any) => i[lv]),
      emphasis: { focus: 'series' }
    }))
  };

  // 导出CSV
  const handleExport = () => {
    if (!stats || !stats.raw_answers) return;
    const header = Object.keys(stats.raw_answers[0]).join(',');
    const rows = stats.raw_answers.map((row: any) => Object.values(row).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'answers.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // 计算加权平均分
  let weightedSum = 0;
  let totalWeight = 0;
  (stats?.dimension_scores || []).forEach(d => {
    const w = dimensionWeights[d.dimension_id] ?? 1;
    weightedSum += d.avg_score * w;
    totalWeight += w;
  });
  const weightedAvg = totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : '-';

  if (loading) return <Spin style={{ margin: 40 }} />;

  return (
    <div>
      {/* 第一块：评估等级分布 */}
      <Card title="评估等级分布" style={{ marginBottom: 32 }}>
        <ReactECharts option={pieOption} style={{ height: 350 }} />
      </Card>

      {/* 第二块：评估等级 × 选项分布 */}
      <Card title="评估等级 × 选项分布" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <span>选择统计字段：</span>
          <Select
            style={{ width: 220 }}
            placeholder="请选择基本信息题目"
            value={selectedBasicQ || undefined}
            onChange={debouncedHandleBasicQChange}
            options={basicQuestions.map(q => ({ label: q.text, value: q.id }))}
            allowClear
          />
        </div>
        {barOption && <ReactECharts option={barOption} style={{ height: 350 }} />}
      </Card>

      {/* 第三块：各维度平均分 */}
      <Card title="各维度平均分" style={{ marginBottom: 32 }}>
        {stats && (
          <>
            <Table
              dataSource={stats.dimension_scores}
              rowKey={r => r.dimension_id}
              columns={[
                { title: '维度', dataIndex: 'dimension_name', key: 'dimension_name' },
                { title: '平均分', dataIndex: 'avg_score', key: 'avg_score' },
              ]}
              pagination={false}
              style={{ marginBottom: 24 }}
            />
            <div style={{ fontWeight: 500, marginTop: 8 }}>
              加权平均分：{weightedAvg}
            </div>
            {dimensions.length > 0 && scores.length > 0 ? (
              <ReactECharts option={radarOption} style={{ height: 450, width: '100%' }} />
            ) : (
              <div style={{ textAlign: 'center', color: '#bbb', padding: 40 }}>暂无数据</div>
            )}
          </>
        )}
      </Card>

      {/* 第四块：区域分布 */}
      {addressQuestions.length > 0 && (
        <Card title="区域分布" style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>选择地址题：</span>
            <Select
              style={{ width: 220 }}
              value={selectedAddressQ}
              onChange={setSelectedAddressQ}
              options={addressQuestions.map(q => ({ label: q.text, value: q.id }))}
            />
            <span>统计级别：</span>
            <Select
              style={{ width: 120 }}
              value={areaLevel}
              onChange={setAreaLevel}
              options={[
                { label: '省', value: 'province' },
                { label: '市', value: 'city' },
                { label: '区', value: 'district' }
              ]}
            />
          </div>
          {areaLevelAgg.data.length > 0 && areaLevelAgg.levelList.length > 0 ? (
            <ReactECharts option={areaLevelBarOption} style={{ height: 320, width: '100%' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#bbb', padding: 40 }}>暂无数据</div>
          )}
          <Table
            dataSource={areaLevelAgg.data}
            rowKey={r => r.area}
            columns={[
              { title: '区域', dataIndex: 'areaName', key: 'areaName' },
              ...areaLevelAgg.levelList.map((lv: string) => ({ title: lv, dataIndex: lv, key: lv }))
            ]}
            pagination={false}
            style={{ marginBottom: 24 }}
          />
        </Card>
      )}
    </div>
  );
};

export default React.memo(QuestionnaireStats); 