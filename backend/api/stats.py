"""
@author yujinyan
@github https://github.com/halouxiaoyu
@description 统计相关API
"""

from flask import Blueprint, jsonify, current_app, request
from models import db, Questionnaire, Submission, Answer, Question, AssessmentLevel, Dimension, Option, BranchRule
from api.auth import token_required
from sqlalchemy import func
import json

bp = Blueprint('stats', __name__, url_prefix='/api/stats')

@bp.route('/questionnaire/<int:qid>/overview', methods=['GET'])
@token_required
def get_questionnaire_overview(qid):
    """获取问卷统计概览
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with questionnaire statistics overview
    """
    try:
        # 获取问卷
        questionnaire = Questionnaire.query.get_or_404(qid)
        
        # 获取所有未删除的答卷
        submissions = Submission.query.filter_by(questionnaire_id=qid, is_deleted=False).all()
        
        # 获取所有未删除答卷的答案
        answers = Answer.query.join(Submission).filter(
            Submission.questionnaire_id == qid,
            Submission.is_deleted == False
        ).all()
        
        # 计算维度平均分
        dimension_scores = {}
        for answer in answers:
            question = Question.query.get(answer.question_id)
            if question and question.dimension_id and answer.value is not None:
                # 排除"用户基本信息(不参与得分评估)"维度
                dimension = Dimension.query.get(question.dimension_id)
                if dimension and dimension.name != '用户基本信息(不参与得分评估)':
                    if question.dimension_id not in dimension_scores:
                        dimension_scores[question.dimension_id] = {'total': 0, 'count': 0}
                    dimension_scores[question.dimension_id]['total'] += answer.value
                    dimension_scores[question.dimension_id]['count'] += 1
        
        # 计算每个维度的平均分
        dimension_avg_scores = []
        for dim_id, scores in dimension_scores.items():
            question = Question.query.filter_by(dimension_id=dim_id).first()
            if question and question.dimension:
                avg_score = scores['total'] / scores['count'] if scores['count'] > 0 else 0
                dimension_avg_scores.append({
                    'dimension_id': dim_id,
                    'dimension_name': question.dimension.name,
                    'avg_score': round(avg_score, 2)
                })
        # 过滤掉"用户基本信息(不参与得分评估)"维度
        dimension_avg_scores = [d for d in dimension_avg_scores if d['dimension_name'] != '用户基本信息(不参与得分评估)']
        
        # 统计 address 题型的区域分布
        area_counter = {}
        for answer in answers:
            question = Question.query.get(answer.question_id)
            if question and question.type == 'address' and answer.text_answer:
                try:
                    val = json.loads(answer.text_answer)
                    area = val.get('area')
                    if area and isinstance(area, list):
                        area_str = '/'.join([str(x) for x in area])
                        area_counter[area_str] = area_counter.get(area_str, 0) + 1
                except (json.JSONDecodeError, TypeError, AttributeError) as e:
                    current_app.logger.warning(f"解析区域数据失败: {str(e)}, answer_id: {answer.id}")
                    continue
        
        # 获取所有 address 题目
        address_questions = Question.query.filter_by(questionnaire_id=qid, type='address').all()
        address_questions_data = [
            {'id': q.id, 'text': q.text} for q in address_questions
        ]

        # 收集所有 address 答案的原始区域数据
        area_stats_raw = []
        area_level_stats_raw = []
        for answer in answers:
            question = Question.query.get(answer.question_id)
            if question and question.type == 'address' and answer.text_answer:
                submission = Submission.query.get(answer.submission_id)
                try:
                    val = json.loads(answer.text_answer)
                    area = val.get('area')
                    if area and isinstance(area, list):
                        area_stats_raw.append({
                            'question_id': answer.question_id,
                            'area': area
                        })
                        area_level_stats_raw.append({
                            'question_id': answer.question_id,
                            'area': area,
                            'level': submission.assessment_level if submission else None
                        })
                except (json.JSONDecodeError, TypeError, AttributeError) as e:
                    current_app.logger.warning(f"解析区域数据失败: {str(e)}, answer_id: {answer.id}")
                    continue
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': {
                'total_submissions': len(submissions),
                'dimension_scores': dimension_avg_scores,
                'area_stats': area_counter,
                'area_stats_raw': area_stats_raw,
                'area_level_stats_raw': area_level_stats_raw,
                'address_questions': address_questions_data,
                'raw_answers': [{
                    'submission_id': a.submission_id,
                    'question_id': a.question_id,
                    'value': a.value,
                    'text_answer': a.text_answer
                } for a in answers]
            }
        })
    except Exception as e:
        current_app.logger.error(f"获取问卷统计概览失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取问卷统计概览失败: {str(e)}'
        }), 500

@bp.route('/questionnaire/<int:qid>/level-stats', methods=['GET'])
@token_required
def get_level_stats(qid):
    """获取评估等级分布统计
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with level distribution statistics
    """
    try:
        # 获取所有未删除答卷的评估等级分布
        level_stats = db.session.query(
            Submission.assessment_level,
            func.count(Submission.id).label('count')
        ).filter(
            Submission.questionnaire_id == qid,
            Submission.assessment_level.isnot(None),
            Submission.is_deleted == False
        ).group_by(
            Submission.assessment_level
        ).all()
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': [{
                'level': level,
                'count': count
            } for level, count in level_stats]
        })
    except Exception as e:
        current_app.logger.error(f"获取评估等级分布统计失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取评估等级分布统计失败: {str(e)}'
        }), 500

@bp.route('/questionnaire/<int:qid>/basic-questions', methods=['GET'])
@token_required
def get_basic_questions(qid):
    """获取基本信息题目列表（只返回配置了分支跳转的题目）"""
    try:
        # 获取基本信息维度的题目
        basic_dimension = db.session.query(Dimension).filter_by(
            questionnaire_id=qid,
            name='用户基本信息(不参与得分评估)'
        ).first()
        
        if not basic_dimension:
            return jsonify({
                'code': 0,
                'msg': 'Success',
                'data': []
            })
        
        questions = Question.query.filter_by(
            questionnaire_id=qid,
            dimension_id=basic_dimension.id
        ).all()
        
        # 只保留有分支规则的题目
        questions_with_branch = []
        for q in questions:
            has_branch = db.session.query(BranchRule).filter_by(question_id=q.id).count() > 0
            if has_branch:
                questions_with_branch.append(q)
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': [{
                'id': q.id,
                'text': q.text,
                'type': q.type
            } for q in questions_with_branch]
        })
    except Exception as e:
        current_app.logger.error(f"获取基本信息题目列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取基本信息题目列表失败: {str(e)}'
        }), 500

@bp.route('/questionnaire/<int:qid>/all-basic-questions', methods=['GET'])
@token_required
def get_all_basic_questions(qid):
    """获取所有基本信息题目列表（用于答卷列表筛选）"""
    try:
        # 获取基本信息维度的题目
        basic_dimension = db.session.query(Dimension).filter_by(
            questionnaire_id=qid,
            name='用户基本信息(不参与得分评估)'
        ).first()
        
        if not basic_dimension:
            return jsonify({
                'code': 0,
                'msg': 'Success',
                'data': []
            })
        
        questions = Question.query.filter_by(
            questionnaire_id=qid,
            dimension_id=basic_dimension.id,
            is_deleted=False
        ).order_by(Question.order).all()
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': [{
                'id': q.id,
                'text': q.text,
                'type': q.type
            } for q in questions]
        })
    except Exception as e:
        current_app.logger.error(f"获取所有基本信息题目列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取所有基本信息题目列表失败: {str(e)}'
        }), 500

@bp.route('/questionnaire/<int:qid>/level-by-basic/<int:question_id>', methods=['GET'])
@token_required
def get_level_by_basic(qid, question_id):
    """获取评估等级与基本信息选项的交叉统计
    
    Args:
        qid: 问卷ID
        question_id: 基本信息题目ID
        
    Returns:
        JSON response with level and basic question option cross statistics
    """
    try:
        # 获取题目
        question = Question.query.get_or_404(question_id)
        
        # 获取所有相关未删除答卷的答案
        answers = db.session.query(
            Answer,
            Submission.assessment_level
        ).join(
            Submission
        ).filter(
            Submission.questionnaire_id == qid,
            Answer.question_id == question_id,
            Submission.assessment_level.isnot(None),
            Submission.is_deleted == False
        ).all()
        
        # 统计每个选项在每个评估等级下的数量
        stats = {}
        for answer, level in answers:
            option_text = None
            question = Question.query.get(answer.question_id)
            if question and question.type == 'address' and answer.text_answer:
                try:
                    val = json.loads(answer.text_answer)
                    area = val.get('area')
                    if area and isinstance(area, list):
                        area_str = '/'.join([str(x) for x in area])
                        option_text = area_str
                except Exception:
                    continue
            elif answer.option_id:
                option = Option.query.get(answer.option_id)
                option_text = option.text if option else None
            elif answer.text_answer and not option_text:
                option_text = answer.text_answer
            if option_text:
                key = (level, option_text)
                stats[key] = stats.get(key, 0) + 1
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': [{
                'level': level,
                'option': option,
                'count': count
            } for (level, option), count in stats.items()]
        })
    except Exception as e:
        current_app.logger.error(f"获取评估等级与基本信息选项的交叉统计失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取评估等级与基本信息选项的交叉统计失败: {str(e)}'
        }), 500

@bp.route('/questionnaire/<int:qid>/submissions', methods=['GET'])
@token_required
def get_submissions(qid):
    """获取问卷的答卷列表，支持按基本信息字段筛选"""
    try:
        print('==== get_submissions called ====')
        print('request.args:', request.args)
        basic_question_id = request.args.get('basic_question_id')
        basic_question_value = request.args.get('basic_question_value')
        area_code_arr = request.args.getlist('area_code_arr')
        if not area_code_arr:
            area_code_arr = request.args.getlist('area_code_arr[]')
        if not area_code_arr:
            area_code_str = request.args.get('area_code_arr')
            if area_code_str:
                area_code_arr = area_code_str.split(',')

        print(f"area_code_arr: {area_code_arr} type: {type(area_code_arr)}")

        query = Submission.query.filter_by(questionnaire_id=qid, is_deleted=False)

        if basic_question_id and (basic_question_value or area_code_arr):
            question = Question.query.get(int(basic_question_id))
            if question and question.type == 'address' and area_code_arr:
                # address题型，按区域前缀匹配（支持省、省市、省市区的部分匹配）
                submission_ids = set()
                answers = Answer.query.filter_by(question_id=int(basic_question_id)).all()
                for ans in answers:
                    if ans.text_answer:
                        try:
                            val = json.loads(ans.text_answer)
                            area = val.get('area')
                            print(f"submission_id={ans.submission_id}, area={area}")
                            if area and isinstance(area, list):
                                area_str_list = [str(x) for x in area]
                                area_code_arr_str = [str(x) for x in area_code_arr]
                                print(f"Compare: {area_str_list[:len(area_code_arr_str)]} == {area_code_arr_str}")
                                # 支持部分匹配：只要前缀匹配就算匹配
                                if len(area_str_list) >= len(area_code_arr_str) and area_str_list[:len(area_code_arr_str)] == area_code_arr_str:
                                    print(f"Matched submission_id={ans.submission_id}")
                                    submission_ids.add(ans.submission_id)
                        except Exception as e:
                            print(f"Error parsing area for submission_id={ans.submission_id}: {e}")
                            continue
                print('submission_ids:', submission_ids)
                if submission_ids:
                    query = query.filter(Submission.id.in_(submission_ids))
                else:
                    # 没有匹配，直接返回空
                    return jsonify({'code': 0, 'msg': 'Success', 'data': []})
            elif question and question.type == 'text':
                # 填空题，支持模糊查询（LIKE匹配）
                query = query.join(Answer).filter(
                    Answer.question_id == int(basic_question_id),
                    Answer.text_answer.like(f'%{basic_question_value}%')
                )
            else:
                # 单选题，按 option_id 匹配（前端应传选项ID）
                try:
                    option_id = int(basic_question_value)
                except Exception:
                    option_id = -1  # 不会有这个id
                query = query.join(Answer).filter(
                    Answer.question_id == int(basic_question_id),
                    Answer.option_id == option_id
                )

        submissions = query.order_by(Submission.id.desc()).all()
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': [{
                'id': s.id,
                'submitted_at': s.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if s.submitted_at else '',
                'total_score': s.total_score,
                'assessment_level': s.assessment_level,
            } for s in submissions]
        })
    except Exception as e:
        current_app.logger.error(f"获取答卷列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取答卷列表失败: {str(e)}'
        }), 500

@bp.route('/questionnaire/<int:qid>/submissions/<int:submission_id>', methods=['DELETE'])
@token_required
def delete_submission(qid, submission_id):
    """软删除答卷"""
    try:
        submission = Submission.query.filter_by(id=submission_id, questionnaire_id=qid).first()
        if not submission:
            return jsonify({
                'code': 404,
                'msg': '答卷不存在'
            }), 404
        
        submission.is_deleted = True
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success'
        })
    except Exception as e:
        current_app.logger.error(f"删除答卷失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'删除答卷失败: {str(e)}'
        }), 500