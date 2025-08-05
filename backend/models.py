"""
@author yujinyan
@github https://github.com/halouxiaoyu
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)

class Questionnaire(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    is_published = db.Column(db.Boolean, default=False)
    published_at = db.Column(db.DateTime)
    access_code = db.Column(db.String(32), unique=True, nullable=True)
    status = db.Column(db.String(20), default='draft')  # 问卷状态：draft草稿、published已发布等
    parent_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'), nullable=True)  # 新增父问卷id
    parent = db.relationship('Questionnaire', remote_side=[id], backref='children')
    # 关系
    dimensions = db.relationship('Dimension', backref='questionnaire', lazy=True, cascade='all, delete-orphan')
    questions = db.relationship('Question', backref='questionnaire', lazy=True, cascade='all, delete-orphan')
    submissions = db.relationship('Submission', backref='questionnaire', lazy=True, cascade='all, delete-orphan')

class Dimension(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    weight = db.Column(db.Float, default=1.0)
    is_deleted = db.Column(db.Boolean, default=False)
    # 关系
    questions = db.relationship('Question', backref='dimension', lazy=True)

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'), nullable=False)
    dimension_id = db.Column(db.Integer, db.ForeignKey('dimension.id'), nullable=True)
    text = db.Column(db.Text, nullable=False)
    type = db.Column(db.Enum('text', 'single', 'multiple', 'area', 'address', name='question_type'), nullable=False)
    order = db.Column(db.Integer)
    # 新增字段
    multiline = db.Column(db.Boolean, default=False)  # 是否多行
    input_rows = db.Column(db.Integer, default=1)     # 行数
    input_type = db.Column(db.String(32), default=None)  # 可选，扩展用
    is_deleted = db.Column(db.Boolean, default=False)
    # 关系
    options = db.relationship('Option', backref='question', lazy=True, cascade='all, delete-orphan')
    answers = db.relationship('Answer', backref='question')

class Option(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    text = db.Column(db.String(200), nullable=False)
    value = db.Column(db.Float, nullable=True)
    is_other = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)

class BranchRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    option_id = db.Column(db.Integer, db.ForeignKey('option.id'), nullable=True)
    next_questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'), nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)

class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'))
    submitted_at = db.Column(db.DateTime, default=datetime.now)
    total_score = db.Column(db.Float)
    assessment_level = db.Column(db.String(50))
    assessment_opinion = db.Column(db.Text)  # 添加评估意见字段
    group_key = db.Column(db.String(100))  # 添加分组字段
    is_deleted = db.Column(db.Boolean, default=False)  # 添加软删除字段
    # 关系
    answers = db.relationship('Answer', backref='submission', lazy=True, cascade='all, delete-orphan')
    dimension_scores = db.relationship('DimensionScore', backref='submission', lazy=True, cascade='all, delete-orphan')

class Answer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('submission.id'))
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'))
    option_id = db.Column(db.Integer)  # 选择题选项id
    value = db.Column(db.Float)  # 选项分值（可选）
    selected_option_ids = db.Column(db.Text)  # 多选题用，存JSON数组
    text_answer = db.Column(db.Text)  # 填空题/"其他"内容

class DimensionScore(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('submission.id'), nullable=False)
    dimension_id = db.Column(db.Integer, db.ForeignKey('dimension.id'), nullable=False)
    score = db.Column(db.Float, nullable=False)
    weight = db.Column(db.Float, nullable=False)
    assessment_level = db.Column(db.String(50))  # 添加维度评估级别
    assessment_opinion = db.Column(db.Text)      # 添加维度评估意见

class AssessmentLevel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    min_score = db.Column(db.Float, nullable=False)
    max_score = db.Column(db.Float, nullable=False)
    opinion = db.Column(db.Text, nullable=False)
    group_key = db.Column(db.String(100))  # 添加分组字段
    dimension_id = db.Column(db.Integer, db.ForeignKey('dimension.id'))  # 添加维度字段
    is_deleted = db.Column(db.Boolean, default=False)

class Response(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    doctor_name = db.Column(db.String(255), nullable=False)
    position = db.Column(db.String(255))
    organization = db.Column(db.String(255))
    department = db.Column(db.String(255))
    experience_years = db.Column(db.Integer)
    current_title = db.Column(db.String(255))
    hospital_position = db.Column(db.String(255))
    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaire.id'), nullable=False)
    submitted_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    # 关系定义
    details = db.relationship('ResponseDetail', backref='response', lazy=True,
                            cascade='all, delete-orphan')

class ResponseDetail(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    response_id = db.Column(db.Integer, db.ForeignKey('response.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    selected_options = db.Column(db.Text)  # JSON array of selected option IDs