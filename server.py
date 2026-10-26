"""FastAPI backend for IOP Benthic Survey Prep Tool.
Provides fast REST APIs, image streaming, quadrat calibration, candidate scoring, and export.
"""
import io
import json
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import benthic_core as core

app = FastAPI(title="IOP Benthic Survey Prep API", version="2.0.0")

# Enable CORS for Vite dev server (default port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ Schemas
class ImportRequest(BaseModel):
    src_path: str
    out_root_path: str
    location: str
    site_code: str
    survey_date: str  # YYYY-MM-DD
    depths: List[int]


class CalibrationSaveRequest(BaseModel):
    base_dir: str
    corners: List[List[float]]  # 4 points: [[x,y], ...]
    cal_source_depth: Optional[int] = None
    cal_source_idx: Optional[int] = 0


class DecisionRequest(BaseModel):
    base_dir: str
    photo: str
    depth: int
    segment: int
    action: str  # 'keep', 'reject', 'auto_reject'
    score: float
    obstruction_conf: Optional[float] = 0.0


class PhotoCalibrationRequest(BaseModel):
    base_dir: str
    photo: str
    corners: List[List[float]]
    crop_box: Optional[dict] = None


class ExportRequest(BaseModel):
    out_root_path: str
    survey_name: str
    selection: dict  # { "25": ["photo1.jpg", ...], ... }
    corners: List[List[float]]
    auto_detect: bool = True
    custom_corners: Optional[dict] = None  # { "photo1.jpg": [[x,y], ...], ... }


# ------------------------------------------------------------------ API Routes
@app.get("/api/sites")
def get_sites():
    """Return all available locations and dive sites."""
    return {"sites": core.SITES}


@app.post("/api/browse-folder")
def browse_folder(title: str = "Select Folder"):
    """Open native OS file explorer dialog to pick a folder."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", 1)
        folder = filedialog.askdirectory(master=root, title=title)
        root.destroy()
        return {"path": folder or ""}
    except Exception as e:
        return {"path": "", "error": str(e)}


@app.get("/api/survey-name")
def get_survey_name(date_str: str, code: str):
    """Generate standardized survey export folder name."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        dt = date.today()
    return {"name": core.survey_name(dt, code)}


@app.post("/api/import")
def run_import(req: ImportRequest):
    """Ingest raw photo files into reserved/<depth>m/ structure."""
    src = Path(req.src_path)
    out_root = Path(req.out_root_path)

    if not src.exists() or not src.is_dir():
        raise HTTPException(status_code=400, detail=f"Source directory '{req.src_path}' does not exist")
    if not out_root.exists() or not out_root.is_dir():
        try:
            out_root.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to create output root: {e}")

    try:
        dt = datetime.strptime(req.survey_date, "%Y-%m-%d").date()
    except ValueError:
        dt = date.today()

    name = core.survey_name(dt, req.site_code)
    L = core.layout(out_root, name)

    counts = core.ingest(src, out_root, name, req.depths)
    return {
        "survey_name": name,
        "base_dir": str(L["base"]),
        "reserved_dir": str(L["reserved"]),
        "counts": counts,
    }


@app.get("/api/cal-candidates")
def get_cal_candidates(base_dir: str, depths: str, count: int = 12):
    """Retrieve raw photo paths for the calibration thumbnail picker."""
    base = Path(base_dir)
    reserved = base / f"{base.name} reserved"
    if not reserved.exists():
        raise HTTPException(status_code=404, detail="Reserved folder not found")

    depth_list = [int(d.strip()) for d in depths.split(",") if d.strip().isdigit()]
    candidates = []

    for d in depth_list:
        folder = reserved / f"{d}m"
        if folder.exists():
            files = sorted(list(folder.glob("*.JPG")) + list(folder.glob("*.jpg")))
            for f in files[:count]:
                candidates.append({"depth": d, "filename": f.name, "path": str(f)})
            if candidates:
                break

    return {"candidates": candidates}


GLOBAL_CAL_FILE = Path.home() / ".iop_bruv_calibration.json"


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.2.0"}


@app.post("/api/calibrate")
def save_calibration(req: CalibrationSaveRequest):
    """Save 1:1 square / 4-corner quadrat calibration."""
    base = Path(req.base_dir)
    if not base.exists():
        base.mkdir(parents=True, exist_ok=True)

    cal_data = {
        "corners": req.corners,
        "source_depth": req.cal_source_depth,
        "source_idx": req.cal_source_idx,
        "saved_at": datetime.utcnow().isoformat(),
    }
    cal_file = base / "calibration.json"
    cal_file.write_text(json.dumps(cal_data, indent=2))

    try:
        GLOBAL_CAL_FILE.write_text(json.dumps(cal_data, indent=2))
    except Exception:
        pass

    return {"status": "ok", "calibration_file": str(cal_file)}


@app.get("/api/calibration")
def get_calibration(base_dir: Optional[str] = None):
    """Load existing calibration for survey or fall back to global last saved."""
    if base_dir:
        base = Path(base_dir)
        cal_file = base / "calibration.json"
        if cal_file.exists():
            try:
                return json.loads(cal_file.read_text())
            except Exception:
                pass

    if GLOBAL_CAL_FILE.exists():
        try:
            return json.loads(GLOBAL_CAL_FILE.read_text())
        except Exception:
            pass

    return {"corners": None}


@app.post("/api/calibrate-photo")
def save_photo_calibration(req: PhotoCalibrationRequest):
    """Save custom calibration crop specifically for a single photo."""
    base = Path(req.base_dir)
    cal_file = base / "calibration.json"
    cal_data = {}
    if cal_file.exists():
        try:
            cal_data = json.loads(cal_file.read_text())
        except Exception:
            pass

    if "photo_overrides" not in cal_data:
        cal_data["photo_overrides"] = {}

    cal_data["photo_overrides"][req.photo] = {
        "corners": req.corners,
        "crop_box": req.crop_box,
        "updated_at": datetime.utcnow().isoformat(),
    }
    cal_file.write_text(json.dumps(cal_data, indent=2))
    return {"status": "ok", "photo": req.photo, "corners": req.corners}



@app.post("/api/candidates")
def get_candidates(
    base_dir: str = Query(...),
    depths: str = Query(...),
    corners_json: str = Query(...),
    k: int = 5,
    auto_detect: bool = True,
):
    """Calculate and return ranked candidates per depth and segment, with scores and obstruction flags."""
    base = Path(base_dir)
    reserved = base / f"{base.name} reserved"
    if not reserved.exists():
        raise HTTPException(status_code=404, detail="Reserved folder not found")

    try:
        corners = json.loads(corners_json)
        if len(corners) != 4:
            raise ValueError
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid corners JSON")

    depth_list = [int(d.strip()) for d in depths.split(",") if d.strip().isdigit()]

    result = {}
    auto_rejected = []

    for d in depth_list:
        folder = reserved / f"{d}m"
        if not folder.exists():
            continue

        files = sorted(list(folder.glob("*.JPG")) + list(folder.glob("*.jpg")))
        if not files:
            continue

        names = [f.name for f in files]
        raw = [core.score_image(f, tuple(map(tuple, corners))) for f in files]
        sc = core.combine_scores(raw)

        # Divide into k segments
        n = len(files)
        seg_size = n / k
        result[str(d)] = {}

        for seg_i in range(k):
            start = int(round(seg_i * seg_size))
            end = int(round((seg_i + 1) * seg_size)) if seg_i < k - 1 else n
            seg_indices = list(range(start, end))
            if not seg_indices:
                continue

            # Rank by score descending
            ranked_indices = sorted(seg_indices, key=lambda i: sc[i], reverse=True)
            candidate_list = []
            
            for idx in ranked_indices:
                photo_name = names[idx]
                photo_path = folder / photo_name
                
                # Pre-check obstruction if auto-detect is enabled
                obs_flag = False
                obs_conf = 0.0
                try:
                    rgb, _ = core.load_rgb(photo_path)
                    sq = core.warp_quadrat(rgb, corners)
                    has_obs, _, conf = core.detect_obstruction(sq)
                    if has_obs and conf >= 0.70:
                        obs_flag = True
                        obs_conf = conf
                        auto_rejected.append({
                            "depth": d,
                            "segment": seg_i,
                            "photo": photo_name,
                            "obs_conf": float(conf),
                        })
                except Exception:
                    pass

                candidate_list.append({
                    "filename": photo_name,
                    "path": str(photo_path),
                    "score": float(sc[idx]),
                    "has_obstruction": obs_flag,
                    "obs_conf": float(obs_conf),
                })

            result[str(d)][str(seg_i)] = candidate_list

    return {"segments": result, "auto_rejected": auto_rejected}


@app.post("/api/decision")
def log_decision_endpoint(req: DecisionRequest):
    """Log user keep/reject decision to decisions.jsonl."""
    base = Path(req.base_dir)
    core.log_decision(
        base,
        {
            "photo": req.photo,
            "depth": req.depth,
            "segment": req.segment,
            "action": req.action,
            "score": req.score,
            "obstruction_conf": req.obstruction_conf,
        },
    )
    return {"status": "logged"}


@app.post("/api/export")
def run_export(req: ExportRequest):
    """Copy chosen photos to chosen/ and generate warped crops in cropped/."""
    out_root = Path(req.out_root_path)
    try:
        # Convert string depth keys back to ints for core.export
        selection_int = {int(k): v for k, v in req.selection.items()}
        corners_tuple = tuple(map(tuple, req.corners))
        n = core.export(
            out_root,
            req.survey_name,
            selection_int,
            corners_tuple,
            auto_detect=req.auto_detect,
            custom_corners=req.custom_corners,
        )

        
        L = core.layout(out_root, req.survey_name)
        warn_path = L["base"] / "crop_warnings.txt"
        has_warnings = warn_path.exists()

        return {
            "status": "ok",
            "count": n,
            "export_base": str(L["base"]),
            "has_warnings": has_warnings,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------- Image Streaming
@app.get("/api/image/raw")
def get_raw_image(path: str, w: Optional[int] = None):
    """Stream fast JPEG of raw image."""
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Image path not found")

    rgb, _ = core.load_rgb(p)
    if w and w > 0:
        h = int(rgb.shape[0] * (w / rgb.shape[1]))
        rgb = cv2.resize(rgb, (w, h))

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    _, enc = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    return Response(content=enc.tobytes(), media_type="image/jpeg")


@app.get("/api/image/warped")
def get_warped_image(
    path: str,
    corners_json: str,
    size: int = 600,
    auto_detect: bool = True,
):
    """Stream fast JPEG of unwarped quadrat crop with optional auto-corner detection badge."""
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Image path not found")

    try:
        corners = json.loads(corners_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid corners")

    rgb, _ = core.load_rgb(p)
    per_photo_corners = corners
    corner_conf = 1.0
    corner_method = "manual"

    if auto_detect:
        det, conf, method = core.detect_corners(rgb)
        if det is not None and method == "classical":
            per_photo_corners = det
            corner_conf = conf
            corner_method = method

    sq = core.warp_quadrat(rgb, per_photo_corners)
    sq_resized = cv2.resize(sq, (size, size))

    bgr = cv2.cvtColor(sq_resized, cv2.COLOR_RGB2BGR)
    _, enc = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    
    headers = {
        "X-Corner-Method": corner_method,
        "X-Corner-Conf": f"{corner_conf:.2f}",
    }
    return Response(content=enc.tobytes(), media_type="image/jpeg", headers=headers)


# Static files server for production build (frontend/dist)
dist_dir = Path(__file__).parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")

if __name__ == "__main__":
    import os
    import subprocess
    import threading
    import time
    import urllib.request
    import webbrowser

    import uvicorn

    HOST, PORT = "127.0.0.1", 8000
    URL = f"http://{HOST}:{PORT}"

    def launch_browser():
        # Wait until the server actually answers instead of a fixed sleep
        for _ in range(100):
            try:
                urllib.request.urlopen(f"{URL}/api/health", timeout=0.5)
                break
            except Exception:
                time.sleep(0.2)

        candidates = [
            os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]
        for exe in candidates:
            if os.path.exists(exe):
                try:
                    subprocess.Popen([exe, f"--app={URL}", "--window-size=1380,880"])
                    return
                except Exception:
                    pass
        webbrowser.open(URL)

    print("=" * 65)
    print("  IOP Benthic Survey Prep Tool - V0.2.0")
    print(f"  Server running on: {URL}")
    print("  Press Ctrl+C in this window to stop.")
    print("=" * 65)

    threading.Thread(target=launch_browser, daemon=True).start()
    uvicorn.run(app, host=HOST, port=PORT, reload=False)