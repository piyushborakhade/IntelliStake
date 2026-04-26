import pytest

from engine import chatbot_api


@pytest.fixture()
def client():
    chatbot_api.app.config["TESTING"] = True
    with chatbot_api.app.test_client() as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def reset_runtime_state():
    chatbot_api._RATE_BUCKETS.clear()
    with chatbot_api._METRICS_LOCK:
        chatbot_api._METRICS["requests_total"] = 0
        chatbot_api._METRICS["errors_total"] = 0
        chatbot_api._METRICS["status_codes"] = {}
        chatbot_api._METRICS["by_endpoint"] = {}


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200

    data = response.get_json()
    assert data["status"] == "ok"


def test_status_endpoint_shape(client):
    response = client.get("/api/status")
    assert response.status_code == 200

    data = response.get_json()
    assert data["status"] == "ready"
    assert "data" in data
    assert "ollama" in data


def test_chat_requires_query(client):
    response = client.post("/api/chat", json={})
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_chat_rejects_non_json_body(client):
    response = client.post("/api/chat", data="hello", content_type="text/plain")
    assert response.status_code == 415


def test_chat_rejects_too_long_query(client):
    response = client.post("/api/chat", json={"query": "x" * 2001})
    assert response.status_code == 400
    assert "too long" in response.get_json()["error"].lower()


def test_clip_classify_requires_input(client):
    response = client.post("/api/clip/classify", json={})
    assert response.status_code == 400


def test_eval_perplexity_rejects_too_long_text(client):
    response = client.post("/api/eval/perplexity", json={"text": "x" * 10001})
    assert response.status_code == 400


def test_metrics_endpoint_exists(client):
    # Prime at least one API metric sample.
    client.get("/health")

    metrics = client.get("/api/metrics")
    assert metrics.status_code == 200

    data = metrics.get_json()
    assert "requests_total" in data
    assert "by_endpoint" in data
    assert "status_codes" in data

    slo = client.get("/api/slo")
    assert slo.status_code == 200
    slo_data = slo.get_json()
    assert "targets" in slo_data
    assert "current" in slo_data
    assert "meets_slo" in slo_data


def test_rate_limit_returns_429_and_retry_after(client):
    original = chatbot_api._RATE_LIMITS["/api/eval/perplexity"]
    chatbot_api._RATE_LIMITS["/api/eval/perplexity"] = (2, 60)
    try:
        ok1 = client.post("/api/eval/perplexity", json={"text": "hello world"})
        ok2 = client.post("/api/eval/perplexity", json={"text": "hello world"})
        limited = client.post("/api/eval/perplexity", json={"text": "hello world"})

        assert ok1.status_code == 200
        assert ok2.status_code == 200
        assert limited.status_code == 429
        assert "Retry-After" in limited.headers
    finally:
        chatbot_api._RATE_LIMITS["/api/eval/perplexity"] = original


def test_request_id_header_present(client):
    response = client.get("/api/status")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
