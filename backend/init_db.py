from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from models import db, Questionnaire, Dimension, Question, Option, BranchRule, Submission, Answer, DimensionScore, AssessmentLevel, Admin
import os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

# 加载环境变量
load_dotenv()

app = Flask(__name__)


user = os.getenv('DB_USER')
password = os.getenv('DB_PASSWORD')
host = os.getenv('DB_HOST')
port = os.getenv('DB_PORT') or '3306'
db_name = os.getenv('DB_NAME')

app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 初始化数据库
db.init_app(app)
migrate = Migrate(app, db)

def init_db():
    with app.app_context():
        # 创建所有表
        db.create_all()
        
        # 创建一些基础数据
        # 1. 创建评估等级
        questionnaire = Questionnaire(
            title='示例问卷',
            description='这是一个示例问卷，用于测试系统功能',
            status='draft'
        )
        db.session.add(questionnaire)
        db.session.flush()  # 获取questionnaire.id
        
        # 1. 创建评估等级（注意 questionnaire_id 不能为 None，opinion 不能为空）
        levels = [
            AssessmentLevel(
                questionnaire_id=questionnaire.id,
                name='优秀', min_score=90, max_score=100, opinion='表现非常优秀'
            ),
            AssessmentLevel(
                questionnaire_id=questionnaire.id,
                name='良好', min_score=80, max_score=89, opinion='表现良好'
            ),
            AssessmentLevel(
                questionnaire_id=questionnaire.id,
                name='中等', min_score=70, max_score=79, opinion='表现中等'
            ),
            AssessmentLevel(
                questionnaire_id=questionnaire.id,
                name='及格', min_score=60, max_score=69, opinion='表现及格'
            ),
            AssessmentLevel(
                questionnaire_id=questionnaire.id,
                name='不及格', min_score=0, max_score=59, opinion='未达及格线'
            ),
        ]
        
        for level in levels:
            db.session.add(level)
        
        # 2. 创建示例维度
        dimensions = [
            Dimension(name='学习能力', weight=0.4, questionnaire_id=questionnaire.id),
            Dimension(name='创新能力', weight=0.3, questionnaire_id=questionnaire.id),
            Dimension(name='团队协作', weight=0.3, questionnaire_id=questionnaire.id)
        ]
        
        for dimension in dimensions:
            db.session.add(dimension)
        
        db.session.commit()
        print("数据库初始化完成！")

        # 创建默认管理员
        if not Admin.query.filter_by(username='admin').first():
            admin = Admin(username='admin', password_hash=generate_password_hash('admin321', method='pbkdf2:sha256'))
            db.session.add(admin)
            db.session.commit()
            print('默认管理员账号已创建：admin / admin321')
        else:
            print('默认管理员已存在')

if __name__ == '__main__':
    init_db() 