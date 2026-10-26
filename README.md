# Benthic Survey Prep Tool

Offline tool for the Indo Ocean Project's Roving Benthic Survey workflow:
imports raw GoPro time-lapse photos, auto-picks the best 5 per depth, and
crops them to a clean 1:1 square from the string quadrat — ready to upload to
CoralNet.

Runs entirely on your own machine. No internet connection needed at runtime,
and no photos leave your computer.

See [`SPEC.md`](./SPEC.md) for the full technical specification.

---

## What's new in v0.2.0

v0.2.0 replaces the Streamlit prototype with a proper **React + FastAPI**
desktop app — faster image streaming, per-photo crop overrides, and a
richer review workflow. The Streamlit `app.py` is kept for reference but
is no longer the recommended entry point.

Key changes:
- **New React + Vite frontend** — fluid UI with lightbox review, drag-and-drop
  calibration, and per-photo crop editor
- **FastAPI backend** (`server.py`) — REST API with efficient JPEG streaming
  (`/api/image/raw`, `/api/image/warped`) replacing Streamlit byte-heavy `st.image`
- **Per-photo calibration overrides** — `PhotoCropEditor` lets you re-drag
  corners on any individual photo without resetting the global calibration
- **Obstruction auto-reject** — YOLOv8-backed detection flags hands / dive
  computers at >= 70% confidence before the review grid is shown
- **Classical corner detection** — HSV + HoughLinesP pipeline auto-refines
  quadrat corners per photo when confidence >= 70%
- **`run.bat`** — double-click launcher (Windows); starts the FastAPI server
  and opens Edge / Chrome in app mode automatically
- **Decision log** — every keep / reject / auto-reject written to
  `decisions.jsonl` for audit trail
- New Python deps: `ultralytics`, `fastapi`, `uvicorn`

---

## Quick start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ (only needed to rebuild the frontend) |

> The pre-built frontend (`frontend/dist/`) is included in the repo, so
> **Node.js is only required if you want to modify the React source.**

---

### Option A — double-click (Windows, recommended)

```
run.bat
```

This will:
1. Detect your Python interpreter (`.venv`, system `py` / `python`)
2. Verify all dependencies are importable
3. Start the FastAPI server on `http://127.0.0.1:8000`
4. Open the app in Edge or Chrome in a frameless app window

---

### Option B — manual (any OS)

```bash
# 1. Clone the repo
git clone https://github.com/thurarchive/Automation.git
cd Automation

# 2. Create & activate a virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate

# macOS / Linux:
source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Start the FastAPI server
python server.py
```

The app opens automatically at `http://127.0.0.1:8000`.

---

### Option C — dev mode (frontend hot-reload)

Run these in two separate terminals:

```bash
# Terminal 1 — backend
python server.py

# Terminal 2 — frontend dev server (Vite on :5173, proxies API calls to :8000)
cd frontend
npm install
npm run dev
```

---

## Before you start a survey

Arrange your raw photos in one folder per dive, split into depth
subfolders, e.g.:

```
raw_photos/
├── 25/
├── 20/
├── 15/
├── 10/
└── 5/
```

(Folder names `25`, `25m`, `25 m` are all accepted.)

---

## Using the app

1. **Location → Dive site → Date** — the sidebar builds the export name
   `BS_YYYYMMDD_CODE` for you.
2. **Import** — point it at your `raw_photos/` folder; it copies and renames
   everything into `<output>/BS_.../BS_..._reserved/<depth>m/`.
3. **Calibrate** — pick the cleanest thumbnail from the grid (Step 1), then
   click the 4 string corners in order: top-left → top-right → bottom-right →
   bottom-left (Step 2). Calibration is saved globally and reloaded on next run.
4. **Select & export** — the grid shows the auto-ranked best photo per
   depth segment. Click any photo to open the lightbox; slide left / right to
   browse ranked candidates, or click the **X** to reject and auto-advance.
   Use the **Crop Editor** button to fine-tune corners for a specific photo.
   Hit **Export** when happy — produces `chosen/` and `cropped/` folders.

---

## Project status

- ✅ Location / site picker, auto-naming, folder import
- ✅ Manual quadrat calibration + square crop (4-corner perspective warp)
- ✅ Heuristic photo scoring (sharpness, lighting evenness, clipping)
- ✅ Even-spacing segment selection with swipe review and auto-next-candidate
- ✅ Per-photo crop override (`PhotoCropEditor`)
- ✅ Obstruction auto-reject (YOLOv8, >= 70% confidence)
- ✅ Classical corner auto-detection (HSV + HoughLinesP, >= 70% confidence)
- ✅ Decision audit log (`decisions.jsonl`)
- ✅ React + Vite frontend with FastAPI backend
- ✅ One-click `run.bat` Windows launcher
- 🚧 Full YOLO-based corner detection (v3 — deferred)
- 🚧 CoralNet direct upload integration

Details for items in progress are in [`SPEC.md`](./SPEC.md).

---

## Reporting a bug / requesting a feature

Please open a GitHub Issue on this repo and include:
- What you were doing (which tab / step)
- What you expected vs. what happened
- A sample photo or screenshot if it's a detection / crop issue (strip GPS
  EXIF if the dive site is sensitive)
- Your OS and Python version

If you'd rather not use GitHub, or for anything involving real survey data,
email **fajrifathur.work@gmail.com**.

---

## Contributing

Pull requests welcome — see [`SPEC.md`](./SPEC.md) for the architecture and
what's planned next before starting on something large, and open an issue
first to avoid duplicate work.

---

## License

MIT — see [`LICENSE`](./LICENSE).

## Contact

Fajri Fathur Rahman — fajrifathur.work@gmail.com
