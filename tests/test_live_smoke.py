import os
import pytest
from fastapi.testclient import TestClient
from api.main import app
from engine.model import generate_text, build_source_block, ModelAuthenticationError

client = TestClient(app)


@pytest.mark.live
def test_live_source_upload_and_summary():
    """
    Live smoke test:
    1. Uploads sample educational text via POST /api/sources/upload.
    2. Retrieves source chunks and wraps them in evidence boundary.
    3. Calls Gemini generate_text to produce a concise summary.
    4. Prints the generated summary to stdout.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or not api_key.startswith("AIza") or api_key == "your_gemini_api_key_here":
        pytest.skip(
            "Valid GEMINI_API_KEY starting with 'AIza' is required in .env for live Gemini smoke test."
        )

    source_text = (
        "Cellular respiration is a series of chemical reactions that break down glucose "
        "to produce ATP, which may be used as energy to power many biological reactions throughout the body. "
        "There are three main stages of cellular respiration: glycolysis, the citric acid cycle (Krebs cycle), "
        "and oxidative phosphorylation. Glycolysis takes place in the cytosol, while the Krebs cycle "
        "and oxidative phosphorylation occur inside the mitochondria."
    )

    # 1. Upload source
    upload_resp = client.post(
        "/api/sources/upload",
        data={"title": "Cellular Respiration Live Test", "text": source_text},
        headers={"X-Role": "teacher"},
    )
    assert upload_resp.status_code == 201, upload_resp.text
    upload_data = upload_resp.json()
    assert upload_data["source_id"] is not None

    # 2. Build prompt with boundary
    source_block = build_source_block([{"idx": 0, "page": 1, "text": source_text}])
    prompt = (
        f"{source_block}\n\n"
        f"Based ONLY on the source text above, summarize the 3 main stages of cellular respiration "
        f"and where they take place in 2-3 concise sentences."
    )

    # 3. Call generate_text
    summary, meta = generate_text(prompt=prompt, prompt_version="1.0")

    assert summary and len(summary.strip()) > 0
    assert meta["model"] is not None
    assert meta["latency_ms"] > 0

    print("\n" + "=" * 60)
    print("LIVE SMOKE TEST OUTPUT:")
    print(f"Model used: {meta['model']} (Latency: {meta['latency_ms']}ms)")
    print(f"Summary:\n{summary.strip()}")
    print("=" * 60)
