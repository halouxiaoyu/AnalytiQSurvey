from models import db, Response, ResponseDetail, Question, Option, Dimension

def calculate_score(response_id):
    # 这里是简单示例，实际可根据你的需求扩展
    response = Response.query.get(response_id)
    details = ResponseDetail.query.filter_by(response_id=response_id).all()
    total_score = 0
    radar = {}
    for detail in details:
        question = Question.query.get(detail.question_id)
        option_ids = eval(detail.selected_options)
        options = Option.query.filter(Option.id.in_(option_ids)).all()
        q_score = sum([opt.value for opt in options]) * question.weight
        # 维度分
        dim = Dimension.query.get(question.dimension_id)
        radar.setdefault(dim.name, 0)
        radar[dim.name] += q_score * dim.weight
        total_score += q_score * dim.weight
    # 评级和评语（示例）
    if total_score > 90:
        level = 'A'
        comment = '优秀'
    elif total_score > 70:
        level = 'B'
        comment = '良好'
    else:
        level = 'C'
        comment = '需提升'
    return total_score, radar, level, comment