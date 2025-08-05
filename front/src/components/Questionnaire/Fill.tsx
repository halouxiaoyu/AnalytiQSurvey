/**
 * @author yujinyan
 * @github https://github.com/halouxiaoyu
 * @description 问卷填写页面组件
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card, Button, Radio, Checkbox, Input, message, Spin, Divider, Form, Space, Cascader } from 'antd';
import { get, post } from '../../utils/request';
import { useParams, useNavigate } from 'react-router-dom';
import './Fill.css';
import areaOptions from './areaOptions'; // 你需要准备一份省市区数据

interface FillProps {
  preview?: boolean;
  access_code?: string;
}

interface Question {
  id: number;
  text: string;
  type: string;
  options?: Array<{
    id: number;
    text: string;
    is_other?: boolean;
  }>;
  branch?: Question[];
  branch_rules?: Array<{
    option_id: number;
    next_questionnaire_id: number;
    next_questionnaire_access_code?: string;
  }>;
  multiline?: boolean;
  input_rows?: number;
  input_type?: string;
}

interface QuestionnaireData {
  id: number;
  title: string;
  description: string;
  questions: Question[];
  dimensions?: any[];
}

interface QuestionnaireResponse {
  access_code: string;
  created_at: string;
  description: string;
  dimensions: any[];
  id: number;
  title: string;
}

interface SubmitResponse {
  submission_id: number;
  total_score: number;
  assessment_level: string;
}

// 递归拍平题目树
const flattenQuestions = (tree: any[]): any[] => {
  const result: any[] = [];
  tree.forEach((node) => {
    result.push(node);
    if (node.branch && node.branch.length > 0) {
      result.push(...flattenQuestions(node.branch));
    }
  });
  return result;
};

// 优化的样式对象，避免每次重新创建
const QUESTION_ITEM_STYLE = { marginBottom: 18, padding: 0 };
const SPACE_STYLE = { width: '100%' };
const FLEX_CENTER_STYLE = { display: 'flex', alignItems: 'center' };
const JUMP_HINT_STYLE = { color: '#3056a5', fontSize: 14, marginLeft: 12, fontWeight: 400 };
const REQUIRED_STYLE = { color: 'red', marginRight: 4, fontSize: 16 };
const OTHER_INPUT_CONTAINER_STYLE = { display: 'flex', alignItems: 'center', marginTop: 4, marginLeft: 32 };
const OTHER_INPUT_STYLE = { width: 180, minHeight: 48, resize: 'none' as const };
const TEXTAREA_STYLE = { minHeight: 48, resize: 'none' as const };

// 地址输入组件
const AddressInput = React.memo<{
  questionId: number;
  value: any;
  onChange: (id: number, value: any) => void;
  preview: boolean;
}>(({ questionId, value, onChange, preview }) => (
  <Space direction="vertical" style={SPACE_STYLE}>
    <Cascader
      options={areaOptions}
      value={value?.area || []}
      onChange={val => onChange(questionId, { ...value, area: val })}
      placeholder="请选择省/市/区"
      style={SPACE_STYLE}
      disabled={preview}
    />
    <Input.TextArea
      value={value?.detail || ''}
      onChange={e => onChange(questionId, { ...value, detail: e.target.value })}
      placeholder="请输入详细地址"
      disabled={preview}
      rows={4}
      maxLength={100}
      style={TEXTAREA_STYLE}
    />
  </Space>
));

// 单选题组件
const SingleChoiceQuestion = React.memo<{
  question: any;
  answer: any;
  otherInputs: any;
  onChange: (id: number, value: any) => void;
  onOtherInput: (key: string, value: string) => void;
  preview: boolean;
}>(({ question, answer, otherInputs, onChange, onOtherInput, preview }) => (
  <Radio.Group
    value={answer}
    onChange={e => onChange(question.id, e.target.value)}
    className="qf-radio-group"
    disabled={preview}
  >
    <Space direction="vertical" style={SPACE_STYLE}>
      {(question.options || []).map((opt: { id: number; text: string; is_other?: boolean }) => (
        <React.Fragment key={opt.id}>
          <div style={FLEX_CENTER_STYLE}>
            <Radio value={opt.id} className="qf-radio" disabled={preview}>{opt.text}</Radio>
          </div>
          {opt.is_other && answer === opt.id && (
            <div style={OTHER_INPUT_CONTAINER_STYLE}>
              <span style={REQUIRED_STYLE}>*</span>
              <Input.TextArea
                className="qf-input"
                style={OTHER_INPUT_STYLE}
                placeholder="请输入"
                value={otherInputs[question.id] || ''}
                onChange={e => onOtherInput(question.id, e.target.value)}
                disabled={preview}
                maxLength={30}
                rows={3}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </Space>
  </Radio.Group>
));

// 多选题组件
const MultipleChoiceQuestion = React.memo<{
  question: any;
  answer: any;
  otherInputs: any;
  onChange: (id: number, value: any) => void;
  onOtherInput: (key: string, value: string) => void;
  preview: boolean;
}>(({ question, answer, otherInputs, onChange, onOtherInput, preview }) => (
  <Checkbox.Group
    value={answer}
    onChange={vals => onChange(question.id, vals.map(Number))}
    className="qf-radio-group"
    disabled={preview}
  >
    <Space direction="vertical" style={SPACE_STYLE}>
      {(question.options || []).map((opt: { id: number; text: string; is_other?: boolean }) => (
        <React.Fragment key={opt.id}>
          <div style={FLEX_CENTER_STYLE}>
            <Checkbox value={opt.id} className="qf-radio" disabled={preview}>{opt.text}</Checkbox>
          </div>
          {opt.is_other && (answer || []).includes(opt.id) && (
            <div style={OTHER_INPUT_CONTAINER_STYLE}>
              <span style={REQUIRED_STYLE}>*</span>
              <Input.TextArea
                className="qf-input"
                style={OTHER_INPUT_STYLE}
                placeholder="请输入"
                value={otherInputs[`${question.id}_${opt.id}`] || ''}
                onChange={e => onOtherInput(`${question.id}_${opt.id}`, e.target.value)}
                disabled={preview}
                maxLength={30}
                rows={3}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </Space>
  </Checkbox.Group>
));

// 文本输入组件
const TextQuestion = React.memo<{
  question: any;
  value: string;
  onChange: (id: number, value: string) => void;
  preview: boolean;
}>(({ question, value, onChange, preview }) => {
  if (question.multiline || (question.input_rows && question.input_rows > 1)) {
    return (
      <Input.TextArea
        className="qf-input"
        value={value || ''}
        onChange={e => onChange(question.id, e.target.value)}
        rows={question.input_rows || 3}
        disabled={preview}
        placeholder="请输入内容"
        maxLength={600}
        style={TEXTAREA_STYLE}
      />
    );
  }
  return (
    <Input
      className="qf-input"
      value={value || ''}
      onChange={e => onChange(question.id, e.target.value)}
      disabled={preview}
      placeholder="请输入内容"
      maxLength={60}
    />
  );
});

// 地区选择组件
const AreaQuestion = React.memo<{
  questionId: number;
  value: any;
  onChange: (id: number, value: any) => void;
  preview: boolean;
}>(({ questionId, value, onChange, preview }) => (
  <Cascader
    options={areaOptions}
    value={value || []}
    onChange={val => onChange(questionId, val)}
    placeholder="请选择省/市/区"
    style={SPACE_STYLE}
    disabled={preview}
  />
));

// 单个问题组件
const QuestionItem = React.memo<{
  question: any;
  index: number;
  answers: any;
  otherInputs: any;
  handleChange: (id: number, value: any) => void;
  handleOtherInput: (key: string, value: string) => void;
  preview: boolean;
}>(({ question, index, answers, otherInputs, handleChange, handleOtherInput, preview }) => {
  const renderQuestionContent = () => {
    switch (question.type) {
      case 'address':
        return (
          <AddressInput
            questionId={question.id}
            value={answers[question.id]}
            onChange={handleChange}
            preview={preview}
          />
        );
      case 'single':
        return (
          <SingleChoiceQuestion
            question={question}
            answer={answers[question.id]}
            otherInputs={otherInputs}
            onChange={handleChange}
            onOtherInput={handleOtherInput}
            preview={preview}
          />
        );
      case 'multiple':
        return (
          <MultipleChoiceQuestion
            question={question}
            answer={answers[question.id]}
            otherInputs={otherInputs}
            onChange={handleChange}
            onOtherInput={handleOtherInput}
            preview={preview}
          />
        );
      case 'text':
        return (
          <TextQuestion
            question={question}
            value={answers[question.id]}
            onChange={handleChange}
            preview={preview}
          />
        );
      case 'area':
        return (
          <AreaQuestion
            questionId={question.id}
            value={answers[question.id]}
            onChange={handleChange}
            preview={preview}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Form.Item
      key={`${question.id}-${index}`}
      className="qf-question-item"
      id={`question-${question.id}`}
      style={QUESTION_ITEM_STYLE}
      label={
        <span className="qf-question-label" style={FLEX_CENTER_STYLE}>
          <span>
            <span className="qf-question-index">{index}</span>
            <span className="qf-question-text">{question.text}</span>
          </span>
          {question.branch_rules && question.branch_rules.length > 0 && (
            <span style={JUMP_HINT_STYLE}>
              （此题设置了跳转）
            </span>
          )}
        </span>
      }
      required
    >
      {renderQuestionContent()}
    </Form.Item>
  );
});

// 递归渲染题目，动态传递序号
const renderQuestions = (
  questions: any[], 
  answers: any, 
  otherInputs: any, 
  handleChange: any, 
  handleOtherInput: any, 
  preview: boolean, 
  startIndex: number
): [JSX.Element[], number] => {
  let idx = startIndex;
  const elements: JSX.Element[] = [];
  
  questions.forEach((q: any) => {
    idx += 1;
    const currentIdx = idx;
    
    elements.push(
      <QuestionItem
        key={`${q.id}-${currentIdx}`}
        question={q}
        index={currentIdx}
        answers={answers}
        otherInputs={otherInputs}
        handleChange={handleChange}
        handleOtherInput={handleOtherInput}
        preview={preview}
      />
    );
    
    if (q.branch && q.branch.length > 0) {
      const [branchElements, nextIdx] = renderQuestions(
        q.branch, 
        answers, 
        otherInputs, 
        handleChange, 
        handleOtherInput, 
        preview, 
        idx
      );
      elements.push(...branchElements);
      idx = nextIdx;
    }
  });
  
  return [elements, idx];
};

const Fill: React.FC<FillProps> = (props) => {
  const routeParams = useParams<{ access_code: string }>();
  const access_code = props.access_code || routeParams.access_code;
  const preview = props.preview || false;
  const [loading, setLoading] = useState(false);
  const [rootQuestions, setRootQuestions] = useState<Question[]>([]); // 题目树
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [meta, setMeta] = useState<{ title: string; description: string } | null>(null); // 问卷标题、描述等
  const navigate = useNavigate();
  
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

  // 加载主问卷
  useEffect(() => {
    if (access_code) {
      setLoading(true);
      
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const requestKey = `questionnaire-${access_code}`;
      
      withRequestDeduplication(requestKey, () => 
        get<QuestionnaireData>(`/api/questionnaire/fill/${access_code}`, {
          signal: abortControllerRef.current?.signal
        })
      )
        .then(res => {
          if (isUnmountedRef.current) return;
          
          setMeta({ title: res.data.title, description: res.data.description });
          // 直接用 questions 字段
          const allQuestions = (res.data.questions || []).map(q => ({ ...q, branch: [] }));
          setRootQuestions(allQuestions);
        })
        .catch((error) => {
          if (isUnmountedRef.current || error.name === 'AbortError') return;
          
          console.error('Load questionnaire failed:', error);
          setRootQuestions([]);
          if (error.response?.status === 404) {
            message.error('问卷不存在或已被删除');
          } else {
            message.error('加载问卷失败，请重试');
          }
        })
        .finally(() => {
          if (!isUnmountedRef.current) {
            setLoading(false);
          }
        });
    }
  }, [access_code, withRequestDeduplication]);

  // 处理答案变更 - 使用useCallback优化
  const handleChange = useCallback(async (questionId: number, value: any) => {
    if (preview || isUnmountedRef.current) return;
    
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    
    const all = flattenQuestions(rootQuestions);
    const qIdx = all.findIndex(q => q.id === questionId);
    if (qIdx === -1) return;
    
    const question = all[qIdx];
    let branchRule = null;
    
    if (question.branch_rules && Array.isArray(question.branch_rules)) {
      branchRule = question.branch_rules.find((br: { option_id: number }) => br.option_id === value);
    }
    
    const clearBranch = (node: Question) => {
      node.branch = [];
    };
    clearBranch(question);
    
    if (branchRule && branchRule.next_questionnaire_id) {
      // 优先使用分支规则中的 access_code
      const branch_access_code = branchRule.next_questionnaire_access_code;
      
      if (branch_access_code) {
        try {
          const requestKey = `branch-${branch_access_code}`;
          const fillRes = await withRequestDeduplication(requestKey, () =>
            get<QuestionnaireData>(`/api/questionnaire/fill/${branch_access_code}`, {
              signal: abortControllerRef.current?.signal
            })
          );
          
          if (isUnmountedRef.current) return;
          
          const branchQuestions = (fillRes.data.questions || []).map(q => ({ ...q, branch: [] }));
          setRootQuestions(prevQuestions => {
            const newQuestions = [...prevQuestions];
            const questionIndex = newQuestions.findIndex(q => q.id === questionId);
            if (questionIndex !== -1) {
              newQuestions[questionIndex] = {
                ...newQuestions[questionIndex],
                branch: branchQuestions
              };
            }
            return newQuestions;
          });
        } catch (e: any) {
          if (isUnmountedRef.current || e.name === 'AbortError') return;
          message.warning('分支问卷不存在或已被删除');
        }
      } else {
        // 如果没有 access_code，提示管理员配置问题
        message.warning('分支问卷配置不完整，请联系管理员');
      }
    } else {
      setRootQuestions(prevQuestions => {
        const newQuestions = [...prevQuestions];
        const questionIndex = newQuestions.findIndex(q => q.id === questionId);
        if (questionIndex !== -1) {
          newQuestions[questionIndex] = {
            ...newQuestions[questionIndex],
            branch: []
          };
        }
        return newQuestions;
      });
    }
  }, [preview, rootQuestions, withRequestDeduplication]);

  // 处理"其他"输入 - 使用useCallback优化
  const handleOtherInput = useCallback((questionId: number | string, value: string) => {
    if (preview || isUnmountedRef.current) return;
    setOtherInputs((prev: any) => ({ ...prev, [questionId]: value }));
  }, [preview]);

  // 提交答卷 - 使用useCallback优化
  const handleSubmit = useCallback(async () => {
    if (preview || submitted || isUnmountedRef.current) return;
    
    const all = flattenQuestions(rootQuestions);
    
    // 校验必填
    let missing = null;
    for (const q of all) {
      if (!answers[q.id]) {
        missing = q;
        break;
      }
      // 如果是"其他"选项被选中，且输入框为空
      const otherOpt = q.options?.find((opt: { id: number; text: string; is_other?: boolean }) => opt.is_other);
      if (otherOpt) {
        if (
          (q.type === 'single' && answers[q.id] === otherOpt.id && !otherInputs[q.id]) ||
          (q.type === 'multiple' && (answers[q.id] || []).includes(otherOpt.id) && !otherInputs[`${q.id}_${otherOpt.id}`])
        ) {
          message.warning(`请填写第${all.indexOf(q) + 1}题的"其他"内容`);
          return;
        }
      }
    }
    
    if (missing) {
      message.warning(`请回答第${all.indexOf(missing) + 1}题`);
      return;
    }
    
    setSubmitted(true);
    
    try {
      const answerArr = all.map(q => {
        const answer = answers[q.id];
        if (q.type === 'address') {
          return {
            question_id: q.id,
            text: JSON.stringify(answer)
          };
        }
        if (q.type === 'single') {
          return {
            question_id: q.id,
            answer: answer,
            text: otherInputs[q.id] || null
          };
        }
        if (q.type === 'multiple') {
          // 收集所有"其他"输入内容
          let otherTextArr: string[] = [];
          (q.options || []).forEach((opt: { id: number; text: string; is_other?: boolean }) => {
            if (opt.is_other && (answers[q.id] || []).includes(opt.id)) {
              const val = otherInputs[`${q.id}_${opt.id}`];
              if (val) otherTextArr.push(val);
            }
          });
          return {
            question_id: q.id,
            answer: answer,
            text: otherTextArr.length > 0 ? otherTextArr.join(',') : null
          };
        }
        // 文本题
        return {
          question_id: q.id,
          text: answer
        };
      });
      
      const res = await post<SubmitResponse>(`/api/questionnaire/fill/${access_code}/submit`, { 
        answers: answerArr 
      });
      
      if (isUnmountedRef.current) return;
      
      if (res.data?.submission_id) {
        navigate(`/result/${res.data.submission_id}`);
      } else {
        message.warning('提交失败');
        setSubmitted(false);
      }
    } catch (e: any) {
      if (isUnmountedRef.current || e.name === 'AbortError') return;
      
      console.error('Submit failed:', e);
      message.warning('提交失败，请重试');
      setSubmitted(false);
    }
  }, [preview, submitted, rootQuestions, answers, otherInputs, access_code, navigate]);

  // 使用useMemo缓存渲染结果
  const renderedQuestions = useMemo(() => {
    if (rootQuestions.length === 0) return [];
    return renderQuestions(rootQuestions, answers, otherInputs, handleChange, handleOtherInput, preview, 0)[0];
  }, [rootQuestions, answers, otherInputs, handleChange, handleOtherInput, preview]);

  if (loading) return <div className="qf-loading"><Spin /> 加载中...</div>;
  if (!meta) return <Card>未找到问卷</Card>;

  return (
    <div className="qf-mobile-bg">
      <div className="qf-mobile-header">
        <div className="qf-mobile-title">{meta.title}</div>
        <div className="qf-mobile-desc">{meta.description || '请如实填写以下自查问卷，帮助您更好了解自身情况~'}</div>
      </div>
      <Form layout="vertical" className="qf-mobile-form">
        {renderedQuestions}
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="button" 
            className="qf-submit-btn" 
            onClick={handleSubmit} 
            disabled={preview || submitted}
            loading={submitted}
          >
            {submitted ? '提交中...' : '提交'}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default React.memo(Fill); 