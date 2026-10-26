# Changelog

All notable changes to the Benthic Survey Prep Tool are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.

---

## [0.2.0] — 2026-10-26

### Added

- **React + Vite frontend** — full single-page app replacing the Streamlit UI;
  built artefact shipped in `frontend/dist/` so Node.js is not required at
  runtime
- **FastAPI backend** (`server.py`) — REST endpoints with streaming JPEG
  responses for fast image display:
  - `GET /api/image/raw` — raw photo, optionally resized
  - `GET /api/image/warped` — perspective-corrected crop with corner-method
    badge headers (`X-Corner-Method`, `X-Corner-Conf`)
  - `POST /api/import` — ingest raw folder into reserved structure
  - `POST /api/calibrate` — save global + per-survey calibration JSON
  - `GET /api/calibration` — load calibration (survey-local then global fallback)
  - `POST /api/calibrate-photo` — per-photo corner override
  - `POST /api/candidates` — score all photos, segment, rank, pre-check
    obstructions; returns ranked candidate list with scores + obstruction flags
  - `POST /api/export` — copy chosen photos, apply perspective crop in place
  - `POST /api/decision` — append keep / reject / auto-reject entry to
    `decisions.jsonl` audit log
  - `GET /api/health` — liveness probe
- **`PhotoCropEditor.jsx`** — interactive per-photo corner drag-editor;
  overrides only that photo's crop without touching global calibration
- **Obstruction auto-reject** (`detect_obstruction` in `benthic_core.py`) —
  YOLOv8 (`yolov8n.pt`) scans warped quadrat for person / hand / tool objects;
  photos above 70 % confidence are auto-rejected and listed in the UI
- **Classical corner auto-detection** (`detect_corners`) — HSV mask isolates
  blue string rope, HoughLinesP finds dominant line pairs, intersections give
  4 corners; accepted when confidence >= 70 %
- **Decision audit log** (`log_decision`) — JSONL file written to the survey
  base folder recording every user decision with timestamp, score, and
  obstruction confidence
- **`run.bat`** — one-click Windows launcher; detects `.venv` / system Python,
  imports `server` to catch missing packages early, warns about missing
  `frontend/dist`, then starts the server and opens Edge / Chrome in app mode
- **`test_v2.py`** — smoke-test script for backend API endpoints
- New Python dependencies: `ultralytics`, `fastapi`, `uvicorn`

### Changed

- `benthic_core.py` — added `detect_corners`, `detect_obstruction`,
  `log_decision`; extended `export()` with `custom_corners` kwarg for
  per-photo overrides; `ingest()` now creates depth sub-dirs as needed
- `requirements.txt` — added `ultralytics`, `fastapi`, `uvicorn`
- `README.md` — full rewrite: quickstart with Option A (run.bat), B (manual),
  C (dev hot-reload); updated project status checklist; new "What's new in
  v0.2.0" section

### Deprecated

- `app.py` (Streamlit) — retained for reference; `server.py` is now the
  recommended entry point

---

## [0.1.0] — 2026-10-01

### Added

- Initial Streamlit app (`app.py`) with:
  - Location / site / date picker and `BS_YYYYMMDD_CODE` export naming
  - Folder import with depth-subfolder detection
  - Manual 4-click quadrat calibration with thumbnail picker
  - Heuristic photo scoring (sharpness, lighting evenness, clipping)
  - Even-spacing segment selection with lightbox swipe review
  - Perspective-warp crop export (`chosen/`, `cropped/`)
- `benthic_core.py` — core logic (scoring, warp, ingest, export) decoupled
  from UI
- `requirements.txt` — `streamlit`, `streamlit-image-coordinates`,
  `opencv-python-headless`, `pillow`, `numpy`
