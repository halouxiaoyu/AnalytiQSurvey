from .auth import bp as auth_bp
from .questionnaire import bp as questionnaire_bp
from .admin import bp as admin_bp
from .stats import bp as stats_bp

__all__ = ['auth_bp', 'questionnaire_bp', 'admin_bp', 'stats_bp']