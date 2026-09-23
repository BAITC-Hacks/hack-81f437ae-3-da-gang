from app.api.schemas import Card, Rating

# Each field contributes only when the business supplied non-empty text.
CRITERIA = [
    ('context', 10, 'Опишите текущую ситуацию'),
    ('need', 10, 'Уточните потребность бизнеса'),
    ('data_and_materials', 20, 'Укажите доступные данные и материалы'),
    ('expected_result', 15, 'Опишите ожидаемый результат'),
    ('success_criteria', 15, 'Добавьте измеримые критерии успеха'),
    ('constraints', 10, 'Укажите ограничения, сроки или бюджет'),
    ('users', 10, 'Определите пользователей решения'),
]


def calculate_rating(card: Card) -> Rating:
    score, missing, improvements = 0, [], []
    for field, weight, hint in CRITERIA:
        if (getattr(card, field) or '').strip():
            score += weight
        else:
            missing.append(field)
            improvements.append(f'{hint} (+{weight})')
    absent = [f for f in ('contact', 'interaction_format') if not (getattr(card, f) or '').strip()]
    if absent:
        missing.extend(absent)
        improvements.append('Укажите контакт и формат взаимодействия с бизнесом (+10)')
    else:
        score += 10
    level = 'draft' if score < 40 else 'working' if score < 70 else 'ready' if score < 90 else 'priority'
    return Rating(score=score, level=level, missing=missing, improvements=improvements)
