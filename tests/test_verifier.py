from engine.verifier import normalize_for_matching, verify_quote


def test_verifier_exact_match():
    chunks = [
        {"id": 1, "char_start": 0, "text": "Photosynthesis produces glucose and oxygen."},
        {"id": 2, "char_start": 50, "text": "Chloroplasts contain disc-like thylakoids arranged in grana."},
    ]
    quote = "Photosynthesis produces glucose and oxygen."
    res = verify_quote(quote, chunks)
    assert res.verified is True
    assert res.match_score == 1.0
    assert res.chunk_id == 1
    assert res.char_start == 0
    assert res.char_end == len(quote)


def test_verifier_normalized_match_quotes_and_spaces():
    chunks = [
        {"id": 1, "char_start": 0, "text": "The enzyme “RuBisCO” fixes atmospheric carbon dioxide into   3-PGA."},
    ]
    # Quote with standard quotes and single space
    quote = 'The enzyme "RuBisCO" fixes atmospheric carbon dioxide into 3-PGA.'
    res = verify_quote(quote, chunks)
    assert res.verified is True
    assert res.match_score == 1.0
    assert res.chunk_id == 1


def test_verifier_fuzzy_match_above_threshold():
    chunks = [
        {"id": 10, "char_start": 100, "text": "Light intensity and ambient temperature act as primary limiting factors for plants."},
    ]
    # Slight variation in phrasing (e.g., missing one word)
    quote = "Light intensity and temperature act as primary limiting factors for plants."
    res = verify_quote(quote, chunks, fuzzy_threshold=0.90)
    assert res.verified is True
    assert res.match_score >= 0.90
    assert res.chunk_id == 10


def test_verifier_fabricated_quote_rejected():
    chunks = [
        {"id": 1, "char_start": 0, "text": "Photosynthesis takes place in chloroplasts."},
    ]
    fabricated_quote = "Mitochondria produce ATP through oxidative phosphorylation in animals."
    res = verify_quote(fabricated_quote, chunks, fuzzy_threshold=0.90)
    assert res.verified is False
    assert res.match_score < 0.90


def test_verifier_resolves_across_multiple_chunks():
    chunks = [
        {"id": 101, "char_start": 0, "text": "First chunk discussing cellular anatomy."},
        {"id": 102, "char_start": 100, "text": "Second chunk discussing electron transport chain and photolysis."},
        {"id": 103, "char_start": 200, "text": "Third chunk discussing Calvin cycle and RuBisCO enzyme."},
    ]
    # Quote from chunk 103
    quote = "Calvin cycle and RuBisCO enzyme"
    res = verify_quote(quote, chunks)
    assert res.verified is True
    assert res.chunk_id == 103
