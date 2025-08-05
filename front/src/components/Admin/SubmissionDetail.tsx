import React, { useEffect, useState } from 'react';
import { Card, Typography, Tag, List, Button, Spin, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { get } from '../../utils/request';
import { ResultContent } from '../Questionnaire/Result';
import areaOptions from '../Questionnaire/areaOptions';

const { Title, Paragraph, Text } = Typography;

interface Question {
  text: string;
  type: string;
  answer?: string;
  option_text?: string;
  fillin_text?: string;
}

interface SubmissionData {
  questions: Question[];
  [key: string]: any;
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

const SubmissionDetail: React.FC = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [data, setData] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (submissionId) {
      setLoading(true);
      get<SubmissionData>(`/api/questionnaire/fill/result/${submissionId}`)
        .then(res => setData(res.data))
        .catch(() => { setData(null); message.error('加载详情失败'); })
        .finally(() => setLoading(false));
    }
  }, [submissionId]);

  if (loading) return <Spin style={{ margin: 40 }} />;
  if (!data) return <Card>未找到答卷</Card>;

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', padding: '32px 0' }}>
      <ResultContent data={data} />
      <Card
        style={{ maxWidth: 700, margin: '32px auto', borderRadius: 12, boxShadow: '0 2px 8px #f0f1f2' }}
        title="答题明细"
        bordered
      >
        <List
          dataSource={data.questions}
          renderItem={(item: Question, idx) => (
            <List.Item
              style={{
                background: idx % 2 === 0 ? '#fafafa' : '#fff',
                borderRadius: 8,
                marginBottom: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                padding: 20,
                border: '1px solid #f0f0f0'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{item.text}</div>
                <div>
                  <span style={{ color: '#888' }}>答案：</span>
                  {item.type === 'address' ? (
                    (() => {
                      let val = null;
                      try { val = JSON.parse(item.answer || '{}'); } catch {}
                      let areaStr = '-';
                      if (val?.area && Array.isArray(val.area) && val.area.length > 0) {
                        areaStr = getAreaNameByCodes(val.area);
                      }
                      return (
                        <span style={{ color: '#1677ff', fontWeight: 500 }}>
                          {areaStr}{val?.detail ? `，${val.detail}` : ''}
                        </span>
                      );
                    })()
                  ) : item.type === 'text'
                    ? (
                        <span style={{ color: '#1677ff', fontWeight: 500 }}>
                          {item.answer ? item.answer : <span style={{ color: '#bbb' }}>未填写</span>}
                        </span>
                      )
                    : (
                        <>
                          <span style={{ color: '#222', fontWeight: 500 }}>
                            {item.option_text || item.answer || <span style={{ color: '#bbb' }}>未填写</span>}
                          </span>
                          {item.fillin_text && (
                            <Tag color="gold" style={{ marginLeft: 8 }}>{item.fillin_text}</Tag>
                          )}
                        </>
                      )
                  }
                </div>
              </div>
              {console.log(item)}
            </List.Item>
          )}
        />
      </Card>
      <Button type="primary" style={{ display: 'block', margin: '24px auto 0' }} onClick={() => navigate(-1)}>
        返回列表
      </Button>
    </div>
  );
};

export default SubmissionDetail; 