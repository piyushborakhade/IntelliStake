# IntelliStake Supabase Setup

The local project is already wired to Supabase:

- Frontend: `dashboard/.env` and `dashboard/src/utils/supabase.js`
- Backend: `engine/.env` and `engine/chatbot_api.py`
- Datapool importer: `scripts/import_datapool_to_supabase.py`

## One-Time Database Setup

1. Open Supabase Dashboard.
2. Go to `SQL Editor`.
3. Open `supabase/schema.sql` from this repo.
4. Paste the full SQL into Supabase.
5. Click `Run`.

This creates:

- `users`
- `portfolio_holdings`
- `watchlist`
- `user_sessions`
- `browse_history`
- `startup_dataset`
- `funding_rounds`
- `shap_narratives`
- `finbert_headlines`

## Import The Datapool

Fast demo import:

```bash
python3 scripts/import_datapool_to_supabase.py --limit 1000
```

Full import:

```bash
python3 scripts/import_datapool_to_supabase.py --all
```

Full import pushes:

- 74,577 startup records from `unified_data/cleaned/intellistake_startups_clean.json`
- 46,809 funding rounds from `unified_data/cleaned/real_funding_data.json`
- 37,699 SHAP narratives from `unified_data/4_production/shap_narratives.json`
- FinBERT scored headlines from `unified_data/4_production/finbert_sentiment_scores.json`

## Verify

```bash
curl http://127.0.0.1:5500/health
curl http://127.0.0.1:5500/api/user/portfolio-summary
```

If the schema has not been run, Flask still works with demo fallback data, but the importer will say that tables such as `startup_dataset` do not exist.
