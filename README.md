# 📋 智能问卷调查系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18.3+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.5+-blue.svg)](https://www.typescriptlang.org/)

一个现代化的智能问卷调查系统，支持多维度评估、智能评分、数据可视化和管理功能。采用前后端分离架构，提供完整的问卷设计、发布、填写和数据分析解决方案。

## ✨ 主要特性

### 🎯 核心功能
- **智能问卷设计** - 支持多维度、多层级的问题设计
- **动态评分系统** - 基于维度的智能评分算法
- **实时数据统计** - 丰富的图表和数据分析功能
- **权限管理** - 完善的管理员权限控制
- **响应式设计** - 支持PC和移动端访问

### 📊 数据可视化
- **多维度分析** - 按维度、地区、时间等多角度分析
- **图表展示** - 柱状图、饼图、折线图等多种图表
- **实时统计** - 实时更新问卷填写情况和统计结果
- **导出功能** - 支持数据导出和报表生成

### 🔧 技术特性
- **前后端分离** - React + Flask 现代化架构
- **TypeScript** - 类型安全的代码开发
- **响应式UI** - 基于Ant Design的现代化界面
- **数据库优化** - MySQL连接池和性能优化
- **安全防护** - CORS、Session管理等安全措施

## 🛠️ 技术栈

### 前端技术
- **React 18.3+** - 现代化的前端框架
- **TypeScript 4.5+** - 类型安全的JavaScript超集
- **Ant Design 5.26+** - 企业级UI组件库
- **Vite 2.7+** - 快速的构建工具
- **React Router 6.2+** - 客户端路由管理
- **ECharts 5.6+** - 数据可视化图表库

### 后端技术
- **Flask 3.0+** - 轻量级Python Web框架
- **SQLAlchemy 2.0+** - Python ORM框架
- **MySQL 8.0+** - 关系型数据库
- **Flask-Migrate** - 数据库迁移管理
- **Flask-CORS** - 跨域资源共享
- **Gunicorn** - WSGI HTTP服务器

### 部署技术
- **Nginx** - 反向代理和静态文件服务
- **Supervisor** - 进程管理
- **Docker** - 容器化部署（可选）

## 📦 快速开始

### 环境要求
- **Node.js** 16+ 
- **Python** 3.10+
- **MySQL** 8.0+
- **Git**

### 1. 克隆项目
```bash
git clone https://github.com/your-username/doctor.git
cd doctor
```

### 2. 后端设置
```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息

# 初始化数据库
export FLASK_APP=app.py
flask db upgrade
python init_db.py
```

### 3. 前端设置
```bash
# 进入前端目录
cd front

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 4. 启动服务
```bash
# 后端（在backend目录下）
flask run

# 前端（在front目录下）
npm run dev
```

访问 http://localhost:3000 开始使用系统

## 🚀 生产环境部署

详细的部署指南请参考 [DEPLOY.md](./DEPLOY.md)

### 快速部署命令
```bash
# 构建前端
cd front && npm run build

# 启动后端服务
cd backend && gunicorn -w 4 -b 127.0.0.1:9000 "app:create_app()"
```

## 📖 使用指南

### 管理员功能
1. **问卷管理** - 创建、编辑、删除问卷
2. **维度管理** - 设置评估维度和权重
3. **问题管理** - 添加、编辑问题内容
4. **数据统计** - 查看填写统计和分析结果
5. **用户管理** - 管理系统用户和权限

### 用户功能
1. **问卷填写** - 在线填写问卷
2. **结果查看** - 查看个人评估结果
3. **历史记录** - 查看历史填写记录

### 默认账号
- **管理员**: admin / admin321
- **请及时修改默认密码！**

## 📁 项目结构

```
doctor/
├── backend/                 # 后端代码
│   ├── api/                # API接口
│   │   ├── admin.py       # 管理员接口
│   │   ├── auth.py        # 认证接口
│   │   ├── questionnaire.py # 问卷接口
│   │   └── stats.py       # 统计接口
│   ├── models.py          # 数据模型
│   ├── app.py             # 应用入口
│   ├── requirements.txt   # Python依赖
│   └── utils/             # 工具函数
├── front/                  # 前端代码
│   ├── src/
│   │   ├── components/    # React组件
│   │   │   ├── Admin/     # 管理员组件
│   │   │   └── Questionnaire/ # 问卷组件
│   │   ├── api/           # API调用
│   │   ├── router/        # 路由配置
│   │   └── types/         # TypeScript类型
│   ├── package.json       # Node.js依赖
│   └── vite.config.ts     # Vite配置
├── DEPLOY.md              # 部署文档
└── README.md              # 项目说明
```

## 🔧 配置说明

### 环境变量配置
```env
# 数据库配置
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=doctor_questionnaire

# Flask配置
SECRET_KEY=your_secret_key
FLASK_DEBUG=False

# CORS配置
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### 数据库配置
系统使用MySQL数据库，需要创建数据库和用户：
```sql
CREATE DATABASE doctor_questionnaire CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'doctor_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON doctor_questionnaire.* TO 'doctor_user'@'localhost';
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

### 开发流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范
- 使用TypeScript进行类型检查
- 遵循ESLint代码规范
- 添加适当的注释和文档
- 编写单元测试

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

**yujinyan** - [GitHub](https://github.com/halouxiaoyu)

## 🙏 致谢

- [Ant Design](https://ant.design/) - 优秀的React UI组件库
- [ECharts](https://echarts.apache.org/) - 强大的数据可视化库
- [Flask](https://flask.palletsprojects.com/) - 轻量级Python Web框架
- [React](https://reactjs.org/) - 用于构建用户界面的JavaScript库

## 📞 支持

如果你在使用过程中遇到问题，请：

1. 查看 [Issues](../../issues) 中是否已有类似问题
2. 创建新的 Issue 并详细描述问题
3. 联系作者获取技术支持

---

⭐ 如果这个项目对你有帮助，请给它一个星标！ 