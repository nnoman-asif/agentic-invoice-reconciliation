"""Price-deviation boundary must match matching_logic (exactly-threshold is flagged)."""

from app.tools.anomaly_checks import check_price_deviations


def _match(dev: float) -> dict:
    return {
        "id": "line-1",
        "price_deviation_pct": dev,
        "price_invoiced": 105.0,
        "price_ordered": 100.0,
    }


def test_price_deviation_boundary_at_threshold():
    threshold = 5.0

    below = check_price_deviations([_match(4.9)], threshold=threshold)
    assert below == []

    exact = check_price_deviations([_match(5.0)], threshold=threshold)
    assert len(exact) == 1
    assert exact[0].type == "price_deviation"
    assert exact[0].severity == "warning"

    just_over = check_price_deviations([_match(5.1)], threshold=threshold)
    assert len(just_over) == 1
    assert just_over[0].severity == "warning"

    double = check_price_deviations([_match(10.0)], threshold=threshold)
    assert len(double) == 1
    assert double[0].severity == "critical"
