from flask import Blueprint, jsonify
from models import db, Questionnaire, Submission
from api.auth import token_required

bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@bp.route('/stats', methods=['GET'])
@token_required
def get_stats():
    # 获取问卷总数
    total = Questionnaire.query.count()
    
    # 获取已发布问卷数
    published = Questionnaire.query.filter_by(is_published=True).count()
    
    # 获取医生参与数（未删除的答卷数）
    responses = Submission.query.filter_by(is_deleted=False).count()
    
    return jsonify({
        'code': 0,  # 添加 code 字段，0 表示成功
        'msg': 'Success',
        'data': {
            'total': total,
            'published': published,
            'responses': responses
        }
    }) 