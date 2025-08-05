import React from 'react';
import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import Login from '@/components/Login';
import Layout from '@/components/Layout';
import QuestionnaireList from '@/components/Admin/QuestionnaireList';
import QuestionnaireEdit from '@/components/Admin/QuestionnaireEdit';
import QuestionnaireFill from '@/components/Questionnaire/Fill';
import QuestionnaireResult from '@/components/Questionnaire/Result';
import QuestionnaireStats from '@/components/Admin/QuestionnaireStats';
import QuestionnaireNew from '@/components/Admin/QuestionnaireNew';
import AddDimension from '@/components/Admin/AddDimension';
import AddQuestion from '@/components/Admin/AddQuestion';
import AuthRoute from '@/components/AuthRoute';
import SubmissionList from '@/components/Admin/SubmissionList';
import SubmissionDetail from '@/components/Admin/SubmissionDetail';
import AssessmentLevelConfig from '@/components/Admin/AssessmentLevelConfig';

// 路由配置
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AuthRoute><Layout /></AuthRoute>,
    children: [
      { path: '', element: <Navigate to="/admin/questionnaires" /> },
      { path: 'admin/questionnaires', element: <QuestionnaireList /> },
      { path: 'admin/questionnaires/create', element: <QuestionnaireNew /> },
      { path: 'admin/questionnaires/edit/:id', element: <QuestionnaireEdit /> },
      { path: 'admin/questionnaires/:id/add-dimension', element: <AddDimension /> },
      { path: 'admin/questionnaires/:id/add-question', element: <AddQuestion /> },
      { path: 'admin/questionnaires/stats/:id', element: <QuestionnaireStats /> },
      { path: 'admin/questionnaires/:id/assessment-levels', element: <AssessmentLevelConfig /> },
      { path: 'admin/questionnaires/:id/submissions', element: <SubmissionList /> },
      { path: 'admin/submission/:submissionId', element: <SubmissionDetail /> },
    ],
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/fill/:access_code',
    element: <QuestionnaireFill />,
  },
  {
    path: '/result/:submission_id',
    element: <QuestionnaireResult />,
  },
  {
    path: '*',
    element: <Navigate to="/login" />,
  },
];

// 创建路由器
const router = createBrowserRouter(routes);

export default router; 