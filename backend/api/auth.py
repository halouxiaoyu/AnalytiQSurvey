"""
@author yujinyan
@github https://github.com/halouxiaoyu
"""

from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash, generate_password_hash
from models import db, Admin
import jwt
from datetime import datetime, timedelta
from functools import wraps


import re
import os
from dotenv import load_dotenv

load_dotenv()

bp = Blueprint('auth', __name__)

# 从环境变量获取JWT密钥
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your_secret_key')

def validate_password(password):
    """验证密码强度：6-20位，必须包含字母和数字"""
    if not (6 <= len(password) <= 20):
        return False, "密码长度需为6-20位"
    if not re.search(r"[A-Za-z]", password):
        return False, "密码必须包含字母"
    if not re.search(r"\d", password):
        return False, "密码必须包含数字"
    return True, "密码符合要求"

def create_token(admin_id):
    payload = {
        'admin_id': admin_id,
        'exp': datetime.utcnow() + timedelta(days=1),
        'iat': datetime.utcnow()  # 添加token创建时间
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')
    print('\n=== Token Creation ===')
    print('Admin ID:', admin_id)
    print('Token:', token)
    print('=== End Token Creation ===\n')
    return token

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        print('\n=== Token Verification Start ===')
        print('Request Method:', request.method)
        print('Request Path:', request.path)
        print('Request Headers:', dict(request.headers))
        
        # 检查 Authorization 头
        auth_header = request.headers.get('Authorization')
        print('Authorization Header:', auth_header)
        
        if not auth_header:
            print('No Authorization header found')
            return jsonify({'msg': 'Token is missing'}), 401
        
        try:
            # 检查是否是Bearer token
            parts = auth_header.split()
            print('Auth header parts:', parts)
            
            if len(parts) != 2:
                print('Invalid token format: wrong number of parts')
                return jsonify({'msg': 'Invalid token format'}), 401
                
            if parts[0] != 'Bearer':
                print('Invalid token format: not a Bearer token')
                return jsonify({'msg': 'Invalid token format'}), 401
            
            token = parts[1]
            print('Extracted token:', token)
            
            try:
                print('Attempting to decode token with secret key:', JWT_SECRET_KEY)
                data = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
                print('Decoded token data:', data)
                current_admin_id = data['admin_id']
                
                # 验证管理员是否存在
                admin = Admin.query.get(current_admin_id)
                if not admin:
                    print('Admin not found:', current_admin_id)
                    return jsonify({'msg': 'Invalid admin'}), 401
                    
                print('Token verification successful')
                print('=== Token Verification End ===\n')
                return f(*args, **kwargs)
            except jwt.ExpiredSignatureError:
                print('Token has expired')
                return jsonify({'msg': 'Token has expired'}), 401
            except jwt.InvalidTokenError as e:
                print('Invalid token:', str(e))
                return jsonify({'msg': 'Invalid token'}), 401
        except Exception as e:
            print('Unexpected error:', str(e))
            return jsonify({'msg': 'Token verification failed'}), 401
            
    return decorated

@bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    print('\n=== Login Attempt ===')
    print('Username:', username)
    print('Request Data:', data)
    
    admin = Admin.query.filter_by(username=username).first()
    if not admin:
        print('Login failed: User not found')
        print('=== End Login Attempt ===\n')
        return jsonify({'msg': '用户名或密码错误'}), 401
        
    if not check_password_hash(admin.password_hash, password):
        print('Login failed: Invalid password')
        print('admin.password_hash:', admin.password_hash)
        print('输入密码:', password)
        print('check_password_hash:', check_password_hash(admin.password_hash, password))
        print('=== End Login Attempt ===\n')
        return jsonify({'msg': '用户名或密码错误'}), 401
        
    token = create_token(admin.id)
    response = {
        'msg': 'Login successful',
        'admin_id': admin.id,
        'token': token
    }
    print('Login successful')
    print('Response:', response)
    print('=== End Login Attempt ===\n')
    return jsonify(response)

@bp.route('/verify-token', methods=['GET'])
@token_required
def verify_token():
    return jsonify({'msg': 'Token is valid'})

@bp.route('/password', methods=['POST'])
@token_required
def change_password():
    data = request.json
    token = request.headers.get('Authorization').split('Bearer ')[-1]
    try:
        admin_id = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])['admin_id']
    except Exception as e:
        return jsonify({'msg': 'Token invalid or expired'}), 401
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({'msg': 'Admin not found'}), 401
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    if not old_password or not new_password:
        return jsonify({'msg': '缺少参数'}), 400
    if not check_password_hash(admin.password_hash, old_password):
        return jsonify({'msg': '旧密码错误'}), 400
    
    # 验证新密码强度
    is_valid, message = validate_password(new_password)
    if not is_valid:
        return jsonify({'msg': message}), 400
        
    # 使用更安全的密码哈希方法
    admin.password_hash = generate_password_hash(new_password, method='pbkdf2:sha256')
    db.session.commit()
    return jsonify({'msg': 'Password updated'})