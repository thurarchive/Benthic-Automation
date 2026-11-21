# Benthic Survey Prep Tool

Offline tool for the Indo Ocean Project's Roving Benthic Survey workflow:
imports raw GoPro time-lapse photos, lets you manually pick the best 5 per
depth, calibrates the string quadrat, and exports clean 1:1 square crops —
ready to upload to CoralNet.

Runs entirely on your own machine. No internet connection needed at runtime,
and no photos leave your computer.

See [`SPEC.md`](./SPEC.md) for the full technical specification.  
See [`CHANGELOG.md`](./CHANGELOG.md) for the full version history.

---

## What's new in v0.2.1

v0.2.1 reworks the pipeline into a clear **5-step flow**, replaces the
unreliable YOLO autopick with a **manual gallery pick**, and adds depth-level
re-calibration for cases where the camera shifts between depths.

### Key changes

- **5-step pipeline** — Import → Manual Pick → 1st Calibration → View & Adjust → Export
- **Manual Pick Gallery** — per-depth photo grid with `#1`–`#5` selection
  badges, click-to-undo, and an `⚡ Evenly Pick 5` helper
- **Lightbox is now a centered popup** — no more scrolling to the top of the
  page; opens as a fixed modal over the current view, close with `Esc`
- **Depth-wide re-calibration** — `📐 Calibrate Depth Xm` modal in the review
  step lets you re-draw quadrat corners for a specific depth; applies to every
  photo at that depth automatically
- **Full candidate pool** — all remaining photos (not divided into rigid
  segments) are available as swap candidates in the lightbox
- **Live progress on every step** — ingestion overlay with elapsed timer,
  export modal with real-time progress bar + ETA, spinners on calibration saves
- **Duplicate photo fix** — Windows case-insensitive glob resolved; each photo
  now appears exactly once in the gallery
- **Vertical scroll gallery** in the lightbox candidate panel (replaces
  horizontal strip)

---

## Quick start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ *(only needed to rebuild the frontend)* |

> The pre-built frontend (`frontend/dist/`) is included in the repo, so
> **Node.js is only required if you modify the React source.**

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
git clone https://github.com/thurarchive/Benthic-Automation.git
cd Benthic-Automation

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

To rebuild the frontend distribution after editing React source:

```bash
npm --prefix frontend run build
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

## Using the app — 5-step pipeline

### Step 1 · Import & Setup

Fill in **Location → Dive site → Date** — the app builds the survey name
`BS_YYYYMMDD_CODE` automatically. Point the **Source folder** at your raw
photos directory and hit **Import**. A progress overlay shows elapsed time
while files are copied and renamed into:

```
<output>/BS_.../
└── BS_..._reserved/
    ├── 25m/
    ├── 20m/
    ├── 15m/
    ├── 10m/
    └── 5m/
```

---

### Step 2 · Manual Pick

A **gallery grid** opens for each depth tab (25 m → 20 m → 15 m → 10 m → 5 m).

- Click any thumbnail to select it — a glowing **#1 … #5** badge appears
- Click a selected photo again to **deselect** it
- Use **⚡ Evenly Pick 5 Photos** to auto-select 5 evenly spaced photos as a
  starting point, then adjust manually
- When a depth has 5 selections the **Next: Depth Xm ›** button appears
- Proceed once **all depths** show 5 / 5

---

### Step 3 · 1st Quadrat Calibration

The app shows the chosen photos for the **active depth tab**.

1. Click the clearest thumbnail to open the calibration canvas
2. Click the **4 string corners** in order:
   top-left → top-right → bottom-right → bottom-left
3. Hit **Save Calibration** — this becomes the global survey calibration
   applied to all depths by default

---

### Step 4 · View & Adjust

The review lightbox opens as a **centered popup modal** (press `Esc` to close,
`←` / `A` and `→` / `D` to slide through candidates).

- **Per-photo crop override** — drag corners in the left panel to fine-tune
  the warp for one specific photo
- **Depth-wide re-calibration** — click **📐 Calibrate Depth Xm** to draw
  fresh quadrat corners that apply to every photo at that depth. Useful when
  the camera was bumped while moving to a new depth.
- **Swap candidate** — the right panel shows a vertical scrollable gallery of
  remaining photos for that depth; click any to swap it into the current slot

Corner priority: *photo override* → *depth calibration* → *global calibration*

---

### Step 5 · Select & Export

Review the export summary (chosen photos per depth). Hit **Export** — a
progress modal appears with:
- Real-time progress bar
- Current photo being processed
- ETA countdown (`ETA: ~Xs`)

Outputs written to `<survey>/chosen/` and `<survey>/cropped/`.

---

## Project status

- ✅ Location / site picker, auto-naming, folder import with progress overlay
- ✅ Manual pick gallery — per-depth, 5-photo selection with badges & undo
- ✅ Manual quadrat calibration + 1:1 square crop (4-corner perspective warp)
- ✅ Depth-wide re-calibration (`POST /api/calibrate-depth`)
- ✅ Per-photo crop override in lightbox popup
- ✅ Full candidate pool in lightbox (no rigid segment slicing)
- ✅ Live export progress bar with ETA
- ✅ Heuristic photo scoring (sharpness, lighting evenness, clipping)
- ✅ React + Vite frontend with FastAPI backend
- ✅ One-click `run.bat` Windows launcher
- ⬜ YOLO autopick (reverted — unreliable; manual pick preferred)
- 🚧 Full YOLO-based corner detection (v3 — deferred)
- 🚧 CoralNet direct upload integration

Details for items in progress are in [`SPEC.md`](./SPEC.md).

---

## API reference (backend)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Server liveness check |
| `GET` | `/api/depth-photos` | List all photos per depth for the pick gallery |
| `POST` | `/api/import` | Ingest raw folder → reserved structure |
| `GET` | `/api/calibration` | Load calibration (survey-local → global fallback) |
| `POST` | `/api/calibrate` | Save global quadrat calibration |
| `POST` | `/api/calibrate-depth` | Save depth-specific quadrat calibration |
| `POST` | `/api/calibrate-photo` | Save per-photo corner override |
| `POST` | `/api/candidates` | Score & rank photos; return candidate list |
| `GET` | `/api/image/raw` | Stream raw photo (optionally resized) |
| `GET` | `/api/image/warped` | Stream perspective-corrected crop |
| `GET` | `/api/export-progress` | Poll live export progress (percent + ETA) |
| `POST` | `/api/export` | Run export — copy chosen + crop to `chosen/` & `cropped/` |
| `POST` | `/api/decision` | Append keep / reject entry to `decisions.jsonl` |

---

## Reporting a bug / requesting a feature

Please open a GitHub Issue on this repo and include:
- Which step you were on
- What you expected vs. what happened
- A screenshot if it's a UI or detection issue (strip GPS EXIF if the dive
  site is sensitive)
- Your OS and Python version

For anything involving real survey data, email **fajrifathur.work@gmail.com**.

---

## Contributing

Pull requests welcome — see [`SPEC.md`](./SPEC.md) for the architecture and
what's planned before starting on something large. Open an issue first to avoid
duplicate work.

---

## License

MIT — see [`LICENSE`](./LICENSE).

## Contact

Fajri Fathur Rahman — fajrifathur.work@gmail.com
