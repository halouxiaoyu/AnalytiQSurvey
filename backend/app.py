"""
@author yujinyan
@github https://github.com/halouxiaoyu
"""

from flask import Flask, session, request
from flask_cors import CORS, cross_origin
from flask_migrate import Migrate
from flask_session import Session
from models import db
from api import auth_bp
from api.questionnaire import bp as questionnaire_bp
from api.admin import bp as admin_bp
from api.stats import bp as stats_bp
from datetime import timedelta
import os
from dotenv import load_dotenv
import logging
load_dotenv()

def create_app():
    app = Flask(__name__)
    app.logger.setLevel(logging.INFO)
    user = os.getenv('DB_USER')
    password = os.getenv('DB_PASSWORD')
    host = os.getenv('DB_HOST')
    port = os.getenv('DB_PORT') or '3306'
    db_name = os.getenv('DB_NAME')

    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your_secret_key')
    
    # 添加数据库连接池配置
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 20,  # 增加连接池大小
        'max_overflow': 10,  # 允许的最大溢出连接数
        'pool_timeout': 30,  # 连接池获取连接的超时时间（秒）
        'pool_recycle': 3600,  # 连接回收时间（1小时）
        'pool_pre_ping': True  # 自动检测断开的连接
    }
    
    # Session configuration
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SESSION_FILE_DIR'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flask_session')
    app.config['SESSION_PERMANENT'] = True
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)
    
    # CORS 配置
    allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

    # 健康检查端点 - 必须在 OPTIONS 处理之前定义
    @app.route('/health', methods=['GET'])
    def health_check():
        try:
            # 测试数据库连接
            db.session.execute('SELECT 1')
            return {'status': 'healthy', 'database': 'connected'}, 200
        except Exception as e:
            app.logger.error(f"Health check failed: {e}")
            return {'status': 'unhealthy', 'database': 'disconnected', 'error': str(e)}, 500

    # 处理 OPTIONS 请求 - 排除特定路径
    @app.route('/<path:path>', methods=['OPTIONS'])
    @cross_origin(
        origins=allowed_origins,
        allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With",
                      "Access-Control-Request-Method", "Access-Control-Request-Headers", "X-CSRF-Token"],
        expose_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        supports_credentials=True,
        max_age=3600)
    def options_handler(path):
        # 排除健康检查端点
        if path == 'health':
            return '', 404
        return '', 200

    # 添加请求日志
    @app.before_request
    def log_request_info():
        app.logger.info('\n=== Request Info ===')
        app.logger.info('Method: %s', request.method)
        app.logger.info('Path: %s', request.path)
        app.logger.info('Headers: %s', dict(request.headers))
        if request.is_json:
            app.logger.info('JSON Data: %s', request.get_json())
        app.logger.info('=== End Request Info ===\n')

    # 初始化扩展
    Session(app)
    db.init_app(app)
    migrate = Migrate(app, db)

    # 注册蓝图
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(questionnaire_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(stats_bp)

    # 确保 session 目录存在
    os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)

    with app.app_context():
        db.create_all()

    return app

if __name__ == '__main__':
    app = create_app()
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.getenv('PORT', 9000))
    app.run(debug=debug, port=port)