// API 响应类型
export interface ApiResponse<T = any> {
  code: number;
  message?: string;
  data: T;
}

// 问卷选项类型
export interface Option {
  id: number;
  text: string;
  value: number;
  is_other?: boolean;
}

// 问题类型
export interface Question {
  id: number;
  text: string;
  type: 'single' | 'multiple';
  weight: number;
  is_reverse: boolean;
  is_doctor_info: boolean;
  options: Option[];
}

// 维度类型
export interface Dimension {
  id: number;
  name: string;
  weight: number;
  questions: Question[];
}

// 问卷类型
export interface Questionnaire {
  id: number;
  title: string;
  description: string;
  created_at: string;
  is_published: boolean;
  dimensions: Dimension[];
}

// 问卷统计类型
export interface QuestionnaireStats {
  total: number;
  published: number;
  responses: number;
}

// 最近问卷类型
export interface RecentQuestionnaire {
  id: number;
  title: string;
  created_at: string;
  is_published: boolean;
  response_count: number;
}

// 登录表单类型
export interface LoginForm {
  username: string;
  password: string;
}

// 医生问卷表单类型
export interface DoctorQuestionnaireForm {
  name: string;
  department: string;
  description: string;
}

export interface LoginResponse {
  token: string;
} 