import pytest
from app.api.schemas import Card
from app.business_logic.rating import calculate_rating


def test_empty_and_full():
    assert calculate_rating(Card()).score == 0
    full = Card(**{key: 'Есть сведения' for key in Card.model_fields})
    assert calculate_rating(full).score == 100
    assert calculate_rating(full).missing == []


def test_contact_requires_both_fields_and_whitespace_is_empty():
    assert calculate_rating(Card(contact='mail@example.com')).score == 0
    assert calculate_rating(Card(contact='mail@example.com', interaction_format='Созвон')).score == 10
    assert calculate_rating(Card(context='   ')).score == 0


@pytest.mark.parametrize('values,score,level', [
    ({'context': 'x', 'need': 'x', 'users': 'x'}, 30, 'draft'),
    ({'context': 'x', 'need': 'x', 'data_and_materials': 'x'}, 40, 'working'),
    ({'context': 'x', 'need': 'x', 'data_and_materials': 'x', 'expected_result': 'x', 'success_criteria': 'x'}, 70, 'ready'),
    ({'context': 'x', 'need': 'x', 'data_and_materials': 'x', 'expected_result': 'x', 'success_criteria': 'x', 'users': 'x', 'constraints': 'x'}, 90, 'priority'),
])
def test_thresholds(values, score, level):
    rating = calculate_rating(Card(**values))
    assert (rating.score, rating.level) == (score, level)
