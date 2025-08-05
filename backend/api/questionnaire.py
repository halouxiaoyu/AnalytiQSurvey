"""
@author yujinyan
@github https://github.com/halouxiaoyu
@description 问卷相关API
"""

from flask import Blueprint, request, jsonify, current_app
from flask_cors import cross_origin
from models import db, Questionnaire, Dimension, Question, Option, BranchRule, Submission, Answer, AssessmentLevel, DimensionScore
from api.auth import token_required
from datetime import datetime
import uuid
from sqlalchemy import func
import json
from werkzeug.exceptions import NotFound
from pypinyin import lazy_pinyin
import re

bp = Blueprint('questionnaire', __name__, url_prefix='/api/questionnaire')

def generate_access_code():
    return str(uuid.uuid4())[:8]

def generate_group_key(question, option):
    """
    基于题目和选项的拼音生成稳定的分组键
    """
    question_pinyin = ''.join(lazy_pinyin(question.text))
    option_pinyin = ''.join(lazy_pinyin(option.text))
    return f"{question_pinyin}_{option_pinyin}"

def check_question_has_assessment_config(question_id):
    """检查题目是否配置了评估规则"""
    question = Question.query.get(question_id)
    if not question:
        return False, 0
        
    # 检查是否有基于该题目的评估配置
    question_pinyin = ''.join(lazy_pinyin(question.text))
    
    count = AssessmentLevel.query.filter(
        AssessmentLevel.group_key.like(f"{question_pinyin}_%"),
        AssessmentLevel.is_deleted == False
    ).count()
    
    return count > 0, count

# ==================== 问卷基础管理 ====================

@bp.route('/', methods=['POST'])
@token_required
def create_questionnaire():
    """创建问卷
    
    Returns:
        JSON response with questionnaire id and access code
    """
    data = request.json
    title = data.get('title')
    description = data.get('description')
    parent_id = data.get('parent_id')
    
    if not title or not description:
        return jsonify({
            'code': 400,
            'msg': '标题和描述为必填项'
        }), 400
        
    try:
        access_code = generate_access_code()
        questionnaire = Questionnaire(
            title=title,
            description=description,
            status='draft',
            created_at=datetime.now(),
            access_code=access_code,
            parent_id=parent_id,
            is_published=True if parent_id else False
        )
        db.session.add(questionnaire)
        db.session.flush()

        # 自动添加"用户基本信息(不参与得分评估)"维度，权重为0（仅父问卷自动添加）
        if not parent_id:
            basic_dim = Dimension(
                questionnaire_id=questionnaire.id,
                name='用户基本信息(不参与得分评估)',
                weight=0
            )
            db.session.add(basic_dim)

        db.session.commit()
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': {
                'id': questionnaire.id,
                'access_code': questionnaire.access_code
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"创建问卷失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'创建问卷失败: {str(e)}'
        }), 500

@bp.route('/', methods=['GET'])
@token_required
def get_questionnaire_list():
    """获取问卷列表
    
    Returns:
        JSON response with questionnaire list
    """
    try:
        questionnaires = Questionnaire.query.order_by(Questionnaire.created_at.desc()).all()
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': [{
                'id': q.id,
                'title': q.title,
                'description': q.description,
                'is_published': q.is_published,
                'created_at': q.created_at.isoformat() if q.created_at else None,
                'updated_at': q.updated_at.isoformat() if q.updated_at else None,
                'access_code': q.access_code,
                'status': q.status,
                'parent_id': q.parent_id
            } for q in questionnaires]
        })
    except Exception as e:
        current_app.logger.error(f"获取问卷列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取问卷列表失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>', methods=['GET'])
@token_required
def get_questionnaire(qid):
    """获取问卷详情
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with questionnaire details
    """
    try:
        questionnaire = Questionnaire.query.get_or_404(qid)
        # 子问卷维度复用父问卷
        if questionnaire.parent_id:
            parent = Questionnaire.query.get(questionnaire.parent_id)
            dimensions = Dimension.query.filter_by(questionnaire_id=parent.id, is_deleted=False).all() if parent else []
        else:
            dimensions = Dimension.query.filter_by(questionnaire_id=qid, is_deleted=False).all()
            
        questions = Question.query.filter_by(questionnaire_id=qid, is_deleted=False).order_by(Question.order).all()
        
        # 获取每个题目的选项和分支规则
        questions_data = []
        for q in questions:
            try:
                options = Option.query.filter_by(question_id=q.id, is_deleted=False).all()
                branch_rules = BranchRule.query.filter_by(question_id=q.id, is_deleted=False).all()
                current_app.logger.info(f"[题目ID:{q.id}] options: {[{'id': o.id, 'text': o.text} for o in options]}")
                current_app.logger.info(f"[题目ID:{q.id}] branch_rules: {[{'option_id': br.option_id, 'next_questionnaire_id': br.next_questionnaire_id} for br in branch_rules]}")
            except Exception as e:
                current_app.logger.error(f"[题目ID:{q.id}] 日志打印出错: {e}")
            branch_rules = []
            for br in BranchRule.query.filter_by(question_id=q.id, is_deleted=False).all():
                # 获取分支问卷的 access_code
                next_questionnaire = Questionnaire.query.get(br.next_questionnaire_id)
                branch_rule = {
                    'option_id': br.option_id,
                    'next_questionnaire_id': br.next_questionnaire_id,
                    'next_questionnaire_access_code': next_questionnaire.access_code if next_questionnaire else None
                }
                branch_rules.append(branch_rule)
            
            questions_data.append({
                'id': q.id,
                'text': q.text,
                'type': q.type,
                'dimension_id': q.dimension_id,
                'order': q.order,
                'multiline': getattr(q, 'multiline', False),
                'input_rows': getattr(q, 'input_rows', 1),
                'input_type': getattr(q, 'input_type', None),
                'options': [
                    {
                        'id': opt.id,
                        'text': opt.text,
                        'value': opt.value,
                        'is_other': opt.is_other
                    } for opt in options
                ],
                'branch_rules': branch_rules
            })

        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': {
                'id': questionnaire.id,
                'title': questionnaire.title,
                'description': questionnaire.description,
                'status': questionnaire.status,
                'created_at': questionnaire.created_at.isoformat() if questionnaire.created_at else None,
                'access_code': questionnaire.access_code,
                'parent_id': questionnaire.parent_id,
                'dimensions': [
                    {
                        'id': dim.id,
                        'name': dim.name,
                        'weight': dim.weight
                    } for dim in dimensions
                ],
                'questions': questions_data
            }
        })
    except Exception as e:
        current_app.logger.error(f"获取问卷详情失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取问卷详情失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>', methods=['PUT'])
@token_required
def update_questionnaire(qid):
    """更新问卷
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response
    """
    try:
        data = request.json
        questionnaire = Questionnaire.query.get_or_404(qid)
        title = data.get('title')
        description = data.get('description')
        
        if not title or not description:
            return jsonify({
                'code': 400,
                'msg': '标题和描述为必填项'
            }), 400
            
        questionnaire.title = title
        questionnaire.description = description
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"更新问卷失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'更新问卷失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>', methods=['DELETE'])
@token_required
def delete_questionnaire(qid):
    """删除问卷
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response
    """
    try:
        questionnaire = Questionnaire.query.get_or_404(qid)
        questionnaire.status = 'deleted'
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"删除问卷失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'删除问卷失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>/toggle-publish', methods=['POST'])
@token_required
def toggle_publish(qid):
    """发布/撤回问卷
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with publish status
    """
    try:
        questionnaire = Questionnaire.query.get_or_404(qid)
        if not questionnaire.access_code:
            questionnaire.access_code = generate_access_code()
        questionnaire.is_published = not questionnaire.is_published
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': {
                'is_published': questionnaire.is_published,
                'access_code': questionnaire.access_code
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"切换问卷发布状态失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'切换问卷发布状态失败: {str(e)}'
        }), 500

# ==================== 维度管理 ====================

@bp.route('/<int:qid>/add-dimension', methods=['POST'])
@token_required
def add_dimension(qid):
    """添加维度
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with dimension id
    """
    try:
        data = request.json
        name = data.get('name')
        weight = data.get('weight', 1.0)
        
        if not name:
            return jsonify({
                'code': 400,
                'msg': '维度名称为必填项'
            }), 400
            
        try:
            weight = float(weight)
            if weight < 0 or weight > 1000:
                return jsonify({
                    'code': 400,
                    'msg': '权重必须在0-1000之间'
                }), 400
            weight = round(weight, 2)
        except Exception:
            return jsonify({
                'code': 400,
                'msg': '权重必须为数字'
            }), 400
            
        dimension = Dimension(
            questionnaire_id=qid,
            name=name,
            weight=weight
        )
        db.session.add(dimension)
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': {
                'dimension_id': dimension.id
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"添加维度失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'添加维度失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>/dimension/<int:dimension_id>', methods=['DELETE'])
@token_required
def delete_dimension(qid, dimension_id):
    """删除维度
    
    Args:
        qid: 问卷ID
        dimension_id: 维度ID
        
    Returns:
        JSON response
    """
    try:
        dim = Dimension.query.get(dimension_id)
        if not dim:
            return jsonify({'code': 404, 'msg': '维度不存在'}), 404
        dim.is_deleted = True
        db.session.commit()
        return jsonify({'code': 0, 'msg': '删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 500, 'msg': f'假删除失败: {str(e)}'}), 500

@bp.route('/<int:qid>/dimension/<int:dimension_id>', methods=['PUT'])
@token_required
def update_dimension(qid, dimension_id):
    """编辑维度"""
    try:
        data = request.json
        dimension = Dimension.query.filter_by(id=dimension_id, questionnaire_id=qid, is_deleted=False).first_or_404()
        dimension.name = data.get('name')
        dimension.weight = data.get('weight')
        db.session.commit()
        return jsonify({'code': 0, 'msg': 'Success'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"编辑维度失败: {str(e)}")
        return jsonify({'code': 500, 'msg': f'编辑维度失败: {str(e)}'}), 500

# ==================== 题目管理 ====================

@bp.route('/<int:qid>/add-question', methods=['POST'])
@token_required
def add_question(qid):
    """添加题目
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with question id
    """
    try:
        data = request.json
        text = data.get('text')
        qtype = data.get('type')
        dimension_id = data.get('dimension_id')
        options = data.get('options', [])
        branch_rules = data.get('branch_rules', [])
        
        if not text or not qtype:
            return jsonify({
                'code': 400,
                'msg': '题干和类型为必填项'
            }), 400
            
        # 获取当前问卷的最大 order
        max_order = db.session.query(func.max(Question.order)).filter_by(questionnaire_id=qid, is_deleted=False).scalar()
        if max_order is None:
            max_order = 0

        question = Question(
            questionnaire_id=qid,
            dimension_id=dimension_id,
            text=text,
            type=qtype,
            order=max_order + 1,  # 新题目排在最后
            multiline=data.get('multiline', False),
            input_rows=data.get('input_rows', 1),
            input_type=data.get('input_type')
        )
        db.session.add(question)
        db.session.flush()
        
        # 添加选项，并记录下标和真实id的映射
        option_id_map = {}
        for idx, opt_data in enumerate(options):
            option = Option(
                question_id=question.id,
                text=opt_data.get('text'),
                value=opt_data.get('value', 0),
                is_other=opt_data.get('is_other', False)
            )
            db.session.add(option)
            db.session.flush()
            option_id_map[idx] = option.id
            
        # 添加分支规则
        for br_data in branch_rules:
            option_index = br_data.get('option_id')
            real_option_id = option_id_map.get(option_index)
            if real_option_id is not None:
                rule = BranchRule(
                    questionnaire_id=qid,
                    question_id=question.id,
                    option_id=real_option_id,
                    next_questionnaire_id=br_data.get('next_questionnaire_id')
                )
                db.session.add(rule)
                
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': {
                'question_id': question.id
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"添加题目失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'添加题目失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>/question/<int:question_id>', methods=['DELETE'])
@token_required
def delete_question(qid, question_id):
    """删除题目
    
    Args:
        qid: 问卷ID
        question_id: 题目ID
        
    Returns:
        JSON response
    """
    try:
        # 检查是否配置了评估规则
        has_config, config_count = check_question_has_assessment_config(question_id)
        
        if has_config:
            return jsonify({
                'code': 400,
                'msg': f'该题目已配置了{config_count}条评估规则，请先删除相关评估配置后再删除题目。'
            }), 400
        
        question = Question.query.get(question_id)
        if not question:
            return jsonify({'code': 404, 'msg': '题目不存在'}), 404
        question.is_deleted = True
        db.session.commit()
        return jsonify({'code': 0, 'msg': '删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 500, 'msg': f'假删除失败: {str(e)}'}), 500

@bp.route('/<int:qid>/reorder-questions', methods=['POST'])
@token_required
def reorder_questions(qid):
    """题目排序
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response
    """
    try:
        data = request.json
        orders = data.get('orders', [])
        
        for item in orders:
            q = Question.query.filter_by(id=item['id'], questionnaire_id=qid, is_deleted=False).first()
            if q:
                q.order = item['order']
                
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"题目排序失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'题目排序失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>/question/<int:question_id>', methods=['PUT'])
@token_required
def update_question(qid, question_id):
    """编辑题目，支持所有字段，包括分支规则"""
    try:
        data = request.json
        question = Question.query.filter_by(
            id=question_id, 
            questionnaire_id=qid,
            is_deleted=False
        ).first_or_404()
        # 更新题目基本信息
        question.text = data.get('text')
        question.type = data.get('type')
        question.dimension_id = data.get('dimension_id')
        question.multiline = data.get('multiline', False)
        question.input_rows = data.get('input_rows', 1)
        question.input_type = data.get('input_type')

        # 更新选项
        if data.get('options') is not None:
            Option.query.filter_by(question_id=question_id, is_deleted=False).delete()
            db.session.flush()
            for opt_data in data['options']:
                option = Option(
                    question_id=question_id,
                    text=opt_data.get('text'),
                    value=opt_data.get('value', 0),
                    is_other=opt_data.get('is_other', False)
                )
                db.session.add(option)
            db.session.flush()

        # 更新分支规则
        if data.get('branch_rules') is not None:
            BranchRule.query.filter_by(question_id=question_id, is_deleted=False).delete()
            db.session.flush()
            # 需要重新获取选项id映射（顺序与options一致）
            options = Option.query.filter_by(question_id=question_id, is_deleted=False).all()
            option_id_map = {idx: opt.id for idx, opt in enumerate(options)}
            for br_data in data['branch_rules']:
                option_index = br_data.get('option_id')
                real_option_id = option_id_map.get(option_index)
                if real_option_id is not None:
                    rule = BranchRule(
                        questionnaire_id=qid,
                        question_id=question_id,
                        option_id=real_option_id,
                        next_questionnaire_id=br_data.get('next_questionnaire_id')
                    )
                    db.session.add(rule)
        db.session.commit()
        return jsonify({
            'code': 0,
            'msg': 'Success'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"编辑题目失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'编辑题目失败: {str(e)}'
        }), 500

# ==================== 评估等级管理 ====================

@bp.route('/<int:qid>/assessment-levels', methods=['GET'])
@token_required
def get_assessment_levels(qid):
    """获取评估等级列表
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with assessment levels
    """
    try:
        group_key = request.args.get('group_key')
        query = AssessmentLevel.query.filter_by(questionnaire_id=qid, is_deleted=False)
        
        # 如果指定了分组，则按分组过滤
        if group_key:
            query = query.filter_by(group_key=group_key)
            
        levels = query.order_by(AssessmentLevel.min_score).all()
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': [
                {
                    'id': l.id,
                    'min_score': l.min_score,
                    'max_score': l.max_score,
                    'name': l.name,
                    'opinion': l.opinion,
                    'group_key': l.group_key,
                    'dimension_id': l.dimension_id
                } for l in levels
            ]
        })
    except Exception as e:
        current_app.logger.error(f"获取评估等级列表失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取评估等级列表失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>/assessment-levels', methods=['POST'])
@token_required
def save_assessment_level(qid):
    """保存评估等级
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response
    """
    try:
        data = request.json
        level_id = data.get('id')
        
        if level_id:
            level = AssessmentLevel.query.get(level_id)
            if not level:
                return jsonify({
                    'code': 404,
                    'msg': '规则不存在'
                }), 404
        else:
            level = AssessmentLevel(questionnaire_id=qid)
            db.session.add(level)
            
        level.min_score = data.get('min_score')
        level.max_score = data.get('max_score')
        level.name = data.get('name')
        level.opinion = data.get('opinion')
        level.group_key = data.get('group_key')  # 保存分组
        level.dimension_id = data.get('dimension_id')  # 保存维度
        
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'Success'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"保存评估等级失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'保存评估等级失败: {str(e)}'
        }), 500

@bp.route('/<int:qid>/assessment-levels/<int:level_id>', methods=['DELETE'])
@token_required
def delete_assessment_level(qid, level_id):
    """删除评估等级
    
    Args:
        qid: 问卷ID
        level_id: 评估等级ID
        
    Returns:
        JSON response
    """
    try:
        level = AssessmentLevel.query.get(level_id)
        if not level:
            return jsonify({'code': 404, 'msg': '规则不存在'}), 404
        level.is_deleted = True
        db.session.commit()
        return jsonify({'code': 0, 'msg': '删除成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 500, 'msg': f'假删除失败: {str(e)}'        }), 500

@bp.route('/<int:qid>/basic-groups', methods=['GET'])
@token_required
def get_basic_groups(qid):
    """获取基本信息分组列表（用于前端分组下拉框）
    
    Args:
        qid: 问卷ID
        
    Returns:
        JSON response with basic groups using pinyin group_key format
    """
    try:
        # 获取基本信息维度
        basic_dimension = Dimension.query.filter_by(
            questionnaire_id=qid,
            name='用户基本信息(不参与得分评估)'
        ).first()
        
        if not basic_dimension:
            return jsonify({
                'code': 0,
                'msg': 'Success',
                'data': []
            })
        
        # 获取基本信息维度的单选题，按order排序，只包含未删除的题目
        questions = Question.query.filter_by(
            questionnaire_id=qid,
            dimension_id=basic_dimension.id,
            type='single',
            is_deleted=False
        ).order_by(Question.order).all()
        
        # 找到第一个配置了分支规则的题目
        first_branch_question = None
        for question in questions:
            # 检查分支规则时也要考虑规则的删除状态
            has_branch = BranchRule.query.filter_by(
                question_id=question.id,
                is_deleted=False
            ).count() > 0
            if has_branch:
                first_branch_question = question
                break
        
        groups = []
        if first_branch_question:
            # 只获取第一个配置了分支的题目的选项，只包含未删除的选项
            options = Option.query.filter_by(
                question_id=first_branch_question.id,
                is_deleted=False
            ).all()
            for option in options:
                # 使用与后端一致的拼音生成逻辑
                group_key = generate_group_key(first_branch_question, option)
                groups.append({
                    'group_key': group_key,
                    'label': f"{first_branch_question.text}-{option.text}"
                })
        
        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': groups
        })
        
    except Exception as e:
        current_app.logger.error(f"获取基本分组信息失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取基本分组信息失败: {str(e)}'
        }), 500

# ==================== 问卷填写相关 ====================

@bp.route('/fill/<access_code>', methods=['GET'])
def fill_by_access_code(access_code):
    """获取问卷填写结构
    
    Args:
        access_code: 问卷访问码
        
    Returns:
        JSON response with questionnaire structure
    """
    try:
        if not access_code:
            return jsonify({
                'code': 400,
                'msg': '访问码不能为空'
            }), 400

        questionnaire = Questionnaire.query.filter_by(
            access_code=access_code, 
            is_published=True
        ).first_or_404()

        # 查所有题目，按order排序
        questions = Question.query.filter_by(
            questionnaire_id=questionnaire.id,
            is_deleted=False
        ).order_by(Question.order).all()

        # 查所有维度
        dimensions = Dimension.query.filter_by(
            questionnaire_id=questionnaire.id,
            is_deleted=False
        ).all()

        # 组装题目数据
        questions_data = []
        for q in questions:
            options = Option.query.filter_by(question_id=q.id, is_deleted=False).all()
            branch_rules = []
            for br in BranchRule.query.filter_by(question_id=q.id, is_deleted=False).all():
                # 获取分支问卷的 access_code
                next_questionnaire = Questionnaire.query.get(br.next_questionnaire_id)
                branch_rule = {
                    'option_id': br.option_id,
                    'next_questionnaire_id': br.next_questionnaire_id,
                    'next_questionnaire_access_code': next_questionnaire.access_code if next_questionnaire else None
                }
                branch_rules.append(branch_rule)
            
            questions_data.append({
                'id': q.id,
                'text': q.text,
                'type': q.type,
                'dimension_id': q.dimension_id,
                'order': q.order,
                'multiline': getattr(q, 'multiline', False),
                'input_rows': getattr(q, 'input_rows', 1),
                'input_type': getattr(q, 'input_type', None),
                'options': [
                    {
                        'id': opt.id,
                        'text': opt.text,
                        'value': opt.value,
                        'is_other': opt.is_other
                    } for opt in options
                ],
                'branch_rules': branch_rules
            })

        return jsonify({
            'code': 0,
            'msg': 'Success',
            'data': {
                'id': questionnaire.id,
                'title': questionnaire.title,
                'description': questionnaire.description,
                'status': questionnaire.status,
                'created_at': questionnaire.created_at.isoformat() if questionnaire.created_at else None,
                'access_code': questionnaire.access_code,
                'parent_id': questionnaire.parent_id,
                'dimensions': [
                    {
                        'id': dim.id,
                        'name': dim.name,
                        'weight': dim.weight
                    } for dim in dimensions
                ],
                'questions': questions_data
            }
        })
    except NotFound:
        return jsonify({
            'code': 404,
            'msg': '问卷不存在或已下架'
        }), 404
    except Exception as e:
        current_app.logger.error(f"获取问卷填写结构失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取问卷填写结构失败: {str(e)}'
        }), 500

@bp.route('/fill/<access_code>/submit', methods=['POST'])
def submit_answers(access_code):
    """提交问卷答案
    
    Args:
        access_code: 问卷访问码
        
    Returns:
        JSON response with submission id
    """
    try:
        # 从请求中提取答案数据
        data = request.json
        answers = data.get('answers', [])
        
        if not answers:
            raise ValueError('答案数据不能为空')

        # 获取问卷
        questionnaire = Questionnaire.query.filter_by(
            access_code=access_code,
            is_published=True
        ).first_or_404()

        # 开始事务
        db.session.begin_nested()

        # 创建提交记录
        submission = Submission(
            questionnaire_id=questionnaire.id,
            submitted_at=datetime.now()
        )
        db.session.add(submission)
        db.session.flush()

        # 批量处理答案
        answers_to_insert = []
        total_score = 0
        
        # 预先获取所有问题
        question_ids = [ans.get('question_id') for ans in answers]
        questions = {q.id: q for q in Question.query.filter(Question.id.in_(question_ids), Question.is_deleted==False).all()}
        
        # 预先获取所有选项
        option_ids = []
        for ans in answers:
            if isinstance(ans.get('answer'), list):
                option_ids.extend(ans.get('answer'))
            elif ans.get('answer'):
                option_ids.append(ans.get('answer'))
        options = {o.id: o for o in Option.query.filter(Option.id.in_(option_ids), Option.is_deleted==False).all()}

        for answer_data in answers:
            question_id = answer_data.get('question_id')
            question = questions.get(question_id)
            if not question:
                continue

            option_id = answer_data.get('answer')
            try:
                option_id = int(option_id)
            except (TypeError, ValueError):
                option_id = None
            text = answer_data.get('text')

            # 验证答案数据
            if not question_id:
                raise ValueError('题目ID不能为空')
            if option_id is None and not text and not (isinstance(answer_data.get('answer'), list) and answer_data.get('answer')):
                raise ValueError('答案不能为空')

            # 计算分值
            value = 0
            selected_ids = []
            if question.type == 'multiple':
                # 多选题，answer字段为选项ID数组
                answer_val = answer_data.get('answer')
                if isinstance(answer_val, list):
                    selected_ids = answer_val
                elif isinstance(answer_val, str):
                    selected_ids = [int(x) for x in answer_val.split(',') if x.strip()]
                else:
                    selected_ids = []
                for opt_id in selected_ids:
                    option = options.get(opt_id)
                    if not option:
                        raise ValueError(f'选项不存在: {opt_id}')
                    value += option.value if option.value is not None else 0
                option_id = None  # 多选题不设置单个option_id
            elif option_id is not None:
                # 单选题
                option = options.get(option_id)
                if not option:
                    raise ValueError(f'选项不存在: {option_id}')
                value = option.value if option and option.value is not None else 0

            total_score += value

            # 判断是否需要保存 text_answer
            save_text_answer = False
            if text and isinstance(text, str):
                if question.type == 'multiple':
                    # 多选题，判断选中的选项里是否有 is_other
                    selected_options = [options.get(opt_id) for opt_id in selected_ids if opt_id in options]
                    if any(opt.is_other for opt in selected_options if opt):
                        save_text_answer = True
                elif question.type == 'single':
                    option = options.get(option_id)
                    if option and option.is_other:
                        save_text_answer = True
                elif question.type == 'text':
                    save_text_answer = True

            # 创建答案记录
            if question.type == 'address':
                answer = Answer(
                    submission_id=submission.id,
                    question_id=question_id,
                    text_answer=answer_data.get('text')
                )
                answers_to_insert.append(answer)
                continue

            answer = Answer(
                submission_id=submission.id,
                question_id=question_id,
                option_id=option_id if option_id is not None else None,
                value=value,
                selected_option_ids=json.dumps(selected_ids) if question.type == 'multiple' else None,
                text_answer=text if save_text_answer else None
            )
            answers_to_insert.append(answer)

        # 批量插入答案
        db.session.bulk_save_objects(answers_to_insert)

        # 计算维度分数和评估
        raw_dim_scores = {}
        for answer in answers_to_insert:
            question = questions.get(answer.question_id)
            if question and question.dimension_id:
                # 排除"用户基本信息(不参与得分评估)"维度
                dimension = Dimension.query.get(question.dimension_id)
                if dimension and dimension.name != '用户基本信息(不参与得分评估)':
                    raw_dim_scores.setdefault(question.dimension_id, 0)
                    raw_dim_scores[question.dimension_id] += answer.value if answer.value is not None else 0
        for dim_id, raw_score in raw_dim_scores.items():
            current_app.logger.info(f"[维度原始分] Dimension ID: {dim_id}, Raw Score: {raw_score}")

        # 计算加权分
        weighted_dim_scores = {}
        for dim_id, raw_score in raw_dim_scores.items():
            dimension = Dimension.query.get(dim_id)
            weight = dimension.weight if dimension else 1.0
            weighted_score = raw_score * weight
            weighted_dim_scores[dim_id] = weighted_score
            current_app.logger.info(f"[维度加权分] Dimension ID: {dim_id}, Weighted Score: {weighted_score}, Weight: {weight}")

        # 确定用户分组
        group_key = None
        # 获取基本信息维度
        basic_dimension = Dimension.query.filter_by(
            questionnaire_id=questionnaire.id,
            name='用户基本信息(不参与得分评估)'
        ).first()
        
        if basic_dimension:
            current_app.logger.info(f"[分组确定] 找到基本信息维度: {basic_dimension.id}")
            # 专门查找"所在科室"题目的答案来确定分组
            for answer_data in answers:
                question_id = answer_data.get('question_id')
                question = questions.get(question_id)  # 使用预先获取的问题字典
                if question and question.dimension_id == basic_dimension.id:
                    current_app.logger.info(f"[分组确定] 检查基本信息题目: {question.id} - {question.text}")
                    # 优先查找"所在科室"题目，因为这是分组的关键字段
                    if question.type == 'single' and '科室' in question.text:
                        option_id_raw = answer_data.get('answer')
                        if option_id_raw:
                            try:
                                option_id = int(option_id_raw)  # 确保转换为整数
                                option = options.get(option_id)  # 使用预先获取的选项字典
                                if option:
                                    group_key = generate_group_key(question, option)
                                    current_app.logger.info(f"[分组确定] 生成分组键: {group_key} (题目: {question.text}, 选项: {option.text})")
                                    break
                                else:
                                    current_app.logger.warning(f"[分组确定] 选项不存在: {option_id}")
                            except (ValueError, TypeError) as e:
                                current_app.logger.warning(f"[分组确定] 选项ID转换失败: {option_id_raw}, 错误: {e}")
                    elif question.type == 'address':
                        # 地址题暂时不处理分组
                        current_app.logger.info(f"[分组确定] 跳过地址题目: {question.text}")
                        pass
        else:
            current_app.logger.warning("[分组确定] 未找到基本信息维度")
            
        current_app.logger.info(f"[分组确定] 最终分组键: {group_key}")

        dim_assessments = []
        for dim_id, score in weighted_dim_scores.items():
            # 维度评估等级查询，考虑分组
            level_query = AssessmentLevel.query.filter(
                AssessmentLevel.dimension_id == dim_id,
                AssessmentLevel.min_score <= score,
                AssessmentLevel.max_score >= score
            )
            
            # 如果有分组，优先匹配分组规则
            if group_key:
                level = level_query.filter(AssessmentLevel.group_key == group_key).first()
                if not level:
                    # 如果没有找到分组规则，查找没有分组的规则
                    level = level_query.filter(AssessmentLevel.group_key.is_(None)).first()
            else:
                # 没有分组，查找没有分组的规则
                level = level_query.filter(AssessmentLevel.group_key.is_(None)).first()
                
            current_app.logger.info(f"Dimension ID: {dim_id}, Score: {score}, Group: {group_key}, Level: {level.name if level else 'None'}")
            dim_assessments.append({
                'dimension_id': dim_id,
                'score': score,
                'assessment_level': level.name if level else None,
                'assessment_opinion': level.opinion if level else None
            })

        # 保存维度分数到数据库
        for dim_assessment in dim_assessments:
            # 获取维度的权重
            dimension = Dimension.query.get(dim_assessment['dimension_id'])
            weight = dimension.weight if dimension else 1.0
            
            dim_score = DimensionScore(
                submission_id=submission.id,
                dimension_id=dim_assessment['dimension_id'],
                score=dim_assessment['score'],
                weight=weight,
                assessment_level=dim_assessment['assessment_level'],
                assessment_opinion=dim_assessment['assessment_opinion']
            )
            db.session.add(dim_score)

        # 总分也用加权分数之和
        submission.total_score = sum(weighted_dim_scores.values())

        # 计算评估等级，考虑分组
        level_query = AssessmentLevel.query.filter(
            AssessmentLevel.questionnaire_id == questionnaire.id,
            AssessmentLevel.min_score <= submission.total_score,
            AssessmentLevel.max_score >= submission.total_score,
            AssessmentLevel.dimension_id.is_(None)  # 总分配置
        )
        
        # 如果有分组，优先匹配分组规则
        if group_key:
            level = level_query.filter(AssessmentLevel.group_key == group_key).first()
            if not level:
                # 如果没有找到分组规则，查找没有分组的规则
                level = level_query.filter(AssessmentLevel.group_key.is_(None)).first()
        else:
            # 没有分组，查找没有分组的规则
            level = level_query.filter(AssessmentLevel.group_key.is_(None)).first()

        # 添加日志以检查评估等级和意见
        current_app.logger.info(f"[submit_answers] Group: {group_key}, Assessment Level: {level.name if level else 'None'}, Opinion: {level.opinion if level else 'None'}")
        # 更新提交记录
        submission.group_key = group_key  # 保存分组键
        submission.assessment_level = level.name if level else None
        submission.assessment_opinion = level.opinion if level else None

        # 提交事务
        db.session.commit()

        response_data = {
            'code': 0,
            'msg': '提交成功',
            'data': {
                'submission_id': submission.id,
                'total_score': submission.total_score,
                'assessment_level': submission.assessment_level
            }
        }
        return jsonify(response_data)

    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'code': 400,
            'msg': str(e)
        }), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"提交答案失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'提交失败: {str(e)}'
        }), 500

@bp.route('/fill/result/<int:submission_id>', methods=['GET'])
def get_result(submission_id):
    """获取答卷结果
    Args:
        submission_id: 答卷ID
    Returns:
        JSON response with submission result
    """
    try:
        if not submission_id:
            return jsonify({
                'code': 400,
                'msg': '答卷ID不能为空'
            }), 400

        # 获取答卷
        submission = Submission.query.get_or_404(submission_id)
        questionnaire = Questionnaire.query.get_or_404(submission.questionnaire_id)
        answers = Answer.query.filter_by(submission_id=submission_id).all()
        
        current_app.logger.info(f"[get_result] 提交ID: {submission_id}, 分组: {submission.group_key}")

        # 维度分数聚合
        dim_scores = {}
        question_results = []
        for ans in answers:
            question = Question.query.get(ans.question_id)
            if not question:
                continue
            option_text = None
            fillin_text = getattr(ans, 'text_answer', None)
            # 多选题处理
            if question.type == 'multiple' and ans.selected_option_ids:
                try:
                    s = ans.selected_option_ids
                    if s.startswith('['):
                        selected_ids = json.loads(s)
                    else:
                        selected_ids = [int(x) for x in s.replace('"', '').split(',') if x.strip()]
                    options = Option.query.filter(Option.id.in_(selected_ids)).all()
                    option_texts = []
                    for opt in options:
                        if opt.is_other and fillin_text:
                            # 如果是"其他"选项且有填写内容，显示为"其他（填写内容）"
                            option_texts.append(f"{opt.text}（{fillin_text}）")
                        else:
                            option_texts.append(opt.text)
                    option_text = ', '.join(option_texts)
                except Exception as e:
                    option_text = str(ans.selected_option_ids)
            elif ans.option_id is not None:
                option = Option.query.get(ans.option_id)
                option_text = option.text if option else None
                # 单选题的"其他"处理
                if option and option.is_other and fillin_text:
                    option_text = f"{option_text}（{fillin_text}）"

            # 组装题目结果
            if question.type == 'address':
                question_results.append({
                    'id': question.id,
                    'text': question.text,
                    'type': question.type,
                    'answer': ans.text_answer,
                    'option_id': None,
                    'option_text': None,
                    'fillin_text': None,
                    'value': ans.value
                })
                continue
            question_results.append({
                'id': question.id,
                'text': question.text,
                'type': question.type,
                'answer': (
                    ans.text_answer if question.type == 'text'
                    else option_text
                ),
                'option_id': ans.option_id,
                'option_text': option_text,
                'fillin_text': fillin_text,
                'value': ans.value
            })

        # 获取维度信息
        dim_list = []
        # 获取所有有答案的维度ID
        answered_dimension_ids = set()
        for ans in answers:
            question = Question.query.get(ans.question_id)
            if question and question.dimension_id:
                answered_dimension_ids.add(question.dimension_id)
        
        # 只返回有答案的维度，排除"用户基本信息(不参与得分评估)"维度
        for dim in Dimension.query.filter_by(questionnaire_id=questionnaire.id, is_deleted=False).all():
            # 只包含有题目参与得分计算的维度，且排除基本信息维度
            if dim.id in answered_dimension_ids and dim.name != '用户基本信息(不参与得分评估)':
                # 获取维度得分记录
                dim_score = DimensionScore.query.filter_by(
                    submission_id=submission_id,
                    dimension_id=dim.id
                ).first()
                
                # 获取该维度的最大分数（从评估等级配置中查找，考虑用户分组）
                max_score_query = AssessmentLevel.query.filter_by(
                    dimension_id=dim.id,
                    is_deleted=False
                )
                
                # 如果用户有分组，优先查找该分组的配置
                if submission.group_key:
                    max_score_config = max_score_query.filter_by(
                        group_key=submission.group_key
                    ).order_by(AssessmentLevel.max_score.desc()).first()
                    
                    # 如果没有找到分组配置，查找没有分组的配置
                    if not max_score_config:
                        max_score_config = max_score_query.filter(
                            AssessmentLevel.group_key.is_(None)
                        ).order_by(AssessmentLevel.max_score.desc()).first()
                else:
                    # 没有分组，查找没有分组的配置
                    max_score_config = max_score_query.filter(
                        AssessmentLevel.group_key.is_(None)
                    ).order_by(AssessmentLevel.max_score.desc()).first()
                
                dimension_max_score = max_score_config.max_score if max_score_config else 100
                current_app.logger.info(f"[get_result] 维度 {dim.name} (ID: {dim.id}): 最大分数={dimension_max_score}, 配置来源={'分组' if max_score_config and max_score_config.group_key else '通用'}")
                
                dim_list.append({
                    'dimension_id': dim.id,
                    'dimension_name': dim.name,
                    'score': dim_score.score if dim_score else 0,
                    'max_score': dimension_max_score,
                    'assessment_level': dim_score.assessment_level if dim_score else None,
                    'assessment_opinion': dim_score.assessment_opinion if dim_score else None
                })

        # 获取总分的最大值（从评估等级配置中查找，考虑用户分组）
        total_max_score_query = AssessmentLevel.query.filter_by(
            questionnaire_id=questionnaire.id,
            dimension_id=None,  # 总分配置
            is_deleted=False
        )
        
        # 如果用户有分组，优先查找该分组的配置
        if submission.group_key:
            total_max_score_config = total_max_score_query.filter_by(
                group_key=submission.group_key
            ).order_by(AssessmentLevel.max_score.desc()).first()
            
            # 如果没有找到分组配置，查找没有分组的配置
            if not total_max_score_config:
                total_max_score_config = total_max_score_query.filter(
                    AssessmentLevel.group_key.is_(None)
                ).order_by(AssessmentLevel.max_score.desc()).first()
        else:
            # 没有分组，查找没有分组的配置
            total_max_score_config = total_max_score_query.filter(
                AssessmentLevel.group_key.is_(None)
            ).order_by(AssessmentLevel.max_score.desc()).first()
        
        total_max_score = total_max_score_config.max_score if total_max_score_config else 100
        current_app.logger.info(f"[get_result] 总分最大值: {total_max_score}, 配置来源={'分组' if total_max_score_config and total_max_score_config.group_key else '通用'}")

        response_data = {
            'code': 0,
            'msg': 'Success',
            'data': {
                'total_score': submission.total_score,
                'total_max_score': total_max_score,
                'dimensions': dim_list,
                'questionnaire_title': questionnaire.title,
                'assessment_level': submission.assessment_level,
                'assessment_opinion': submission.assessment_opinion,
                'questions': question_results,
                'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None
            }
        }
        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"获取答卷结果失败: {str(e)}")
        return jsonify({
            'code': 500,
            'msg': f'获取答卷结果失败: {str(e)}'
        }), 500

# ==================== 答卷列表 ====================

@bp.route('/<int:qid>/submissions', methods=['GET'])
@token_required
def get_submissions(qid):
    """获取问卷的答卷列表，支持按基本信息字段筛选"""
    try:
        basic_question_id = request.args.get('basic_question_id')
        basic_question_value = request.args.get('basic_question_value')

        query = Submission.query.filter_by(questionnaire_id=qid)

        if basic_question_id and basic_question_value:
            # 只保留那些有对应答案的答卷
            question = Question.query.get(int(basic_question_id))
            if question and question.type == 'text':
                # 填空题，按 text_answer 匹配
                query = query.join(Answer).filter(
                    Answer.question_id == int(basic_question_id),
                    Answer.text_answer == basic_question_value
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