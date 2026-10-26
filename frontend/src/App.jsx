import React, { useState, useEffect, useRef } from 'react';
import PhotoCropEditor from './PhotoCropEditor';

const LABELS = ["top-left", "top-right", "bottom-right", "bottom-left"];
const ALL_DEPTHS = [30, 25, 20, 15, 10, 5];

const DEFAULT_SITES = {
  "Penida": [
    ["SD Point", "SD", "Penida North"],
    ["Ped", "PD", "Penida North"],
    ["Sental", "SN", "Penida North"],
    ["Batumulapan", "BM", "Penida East"],
    ["Karangsari", "KS", "Penida East"],
    ["Toyapakeh", "TP", "Penida West"],
    ["Mangrove", "MN", "Penida West"],
    ["Crystal Bay", "CB", "Penida West"],
    ["Manta Bay", "MB", "Penida South"],
    ["Manta Point", "MP", "Penida South"],
    ["Labyrinth", "LB", "Penida South"],
    ["Rabbit Hole", "RH", "Penida South"]
  ],
  "Bira": [
    ["Blue Planet", "BP", "Bira West"],
    ["Bira Dive Camp", "BD", "Bira West"],
    ["Stingray Bay", "SB", "Bira West"],
    ["Phinisi Point", "PN", "Bira East"],
    ["Marumasa", "MS", "Bira East"],
    ["Harbour Reef", "HR", "Bira East"],
    ["Kasuso", "KA", "Bira East"],
    ["Mr. Ramli", "MR", "Liukang"],
    ["Shark Point", "SP", "Liukang"],
    ["Mola Mola", "MM", "Kambing"],
    ["Eagle Rock", "ER", "Kambing"],
    ["Great Wall", "GW", "Kambing"],
    ["Coral Garden", "CG", "Kambing"],
    ["The Cave", "CV", "Kambing"]
  ],
  "Raja": [
    ["Scuba Republic", "SR", "Waigeo"],
    ["Friwen Batu", "FB", "Gam"],
    ["Friwen Garden", "FG", "Gam"],
    ["Friwen Wall", "FW", "Gam"],
    ["Batu Lima", "BL", "Gam"],
    ["Blue Magic", "BM", "Kri"],
    ["Sardine Reef", "SA", "Kri"],
    ["Chicken Reef", "CR", "Kri"],
    ["Cape Kri", "CK", "Kri"],
    ["Mioskon", "MI", "Mioskon"],
    ["Lao Lao", "LL", "Mioskon"],
    ["Yenbuba", "YB", "Mansuar"],
    ["Sauwandarek", "SW", "Mansuar"]
  ]
};

const safeJson = async (res) => {
  const text = await res.text();
  if (!text || !text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return { detail: text || `HTTP ${res.status} ${res.statusText}` };
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('import'); // 'import', 'calibrate', 'review'

  // Sites & Location state
  const [sitesMap, setSitesMap] = useState(DEFAULT_SITES);
  const [selectedLoc, setSelectedLoc] = useState('Penida');
  const [selectedSite, setSelectedSite] = useState(DEFAULT_SITES['Penida'][0]);
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split('T')[0]);
  const [surveyName, setSurveyName] = useState('');

  // Folders & Depths
  const [srcPath, setSrcPath] = useState('');
  const [outRootPath, setOutRootPath] = useState('');
  const [selectedDepths, setSelectedDepths] = useState([25, 20, 15, 10, 5]);
  const [attachedSrcInfo, setAttachedSrcInfo] = useState(null);
  const [isDraggingSrc, setIsDraggingSrc] = useState(false);
  const [isDraggingOut, setIsDraggingOut] = useState(false);

  // Handle OS Native Browse Folder button
  const handleBrowseFolder = async (target) => {
    try {
      const res = await fetch('/api/browse-folder', { method: 'POST' });
      if (!res.ok) return;
      const data = await safeJson(res);
      if (data.path) {
        if (target === 'src') {
          setSrcPath(data.path);
          setAttachedSrcInfo({ name: data.path.split(/[/\\]/).pop(), fileCount: null, fullPath: data.path });
        } else if (target === 'out') {
          setOutRootPath(data.path);
        }
      }
    } catch (err) {
      console.error("Browse folder failed:", err);
    }
  };

  // Handle HTML File/Folder Attachment Input
  const handleFolderSelect = (e, target) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const sampleFile = files[0];
    if (sampleFile.path) {
      let folderPath = sampleFile.path;
      const relPath = sampleFile.webkitRelativePath;
      if (relPath) {
        const parts = relPath.split('/');
        const rootFolder = parts[0];
        const idx = folderPath.lastIndexOf(rootFolder);
        if (idx !== -1) {
          folderPath = folderPath.substring(0, idx + rootFolder.length);
        }
      } else {
        folderPath = folderPath.substring(0, Math.max(folderPath.lastIndexOf('/'), folderPath.lastIndexOf('\\')));
      }
      if (target === 'src') {
        setSrcPath(folderPath);
        setAttachedSrcInfo({ name: folderPath.split(/[/\\]/).pop(), fileCount: files.length, fullPath: folderPath });
      } else {
        setOutRootPath(folderPath);
      }
    } else {
      const relPath = sampleFile.webkitRelativePath;
      const folderName = relPath ? relPath.split('/')[0] : (sampleFile.name || 'Selected Folder');
      if (target === 'src') {
        setAttachedSrcInfo({ name: folderName, fileCount: files.length });
        if (!srcPath) setSrcPath(folderName);
      } else {
        if (!outRootPath) setOutRootPath(folderName);
      }
    }
  };

  // Handle Drag & Drop folder onto input area
  const handleDrop = (e, target) => {
    e.preventDefault();
    if (target === 'src') setIsDraggingSrc(false);
    if (target === 'out') setIsDraggingOut(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files || files.length === 0) return;

    const sampleFile = files[0];
    if (sampleFile.path) {
      let folderPath = sampleFile.path;
      const relPath = sampleFile.webkitRelativePath;
      if (relPath) {
        const parts = relPath.split('/');
        const rootFolder = parts[0];
        const idx = folderPath.lastIndexOf(rootFolder);
        if (idx !== -1) {
          folderPath = folderPath.substring(0, idx + rootFolder.length);
        }
      } else {
        folderPath = folderPath.substring(0, Math.max(folderPath.lastIndexOf('/'), folderPath.lastIndexOf('\\')));
      }
      if (target === 'src') {
        setSrcPath(folderPath);
        setAttachedSrcInfo({ name: folderPath.split(/[/\\]/).pop(), fileCount: files.length, fullPath: folderPath });
      } else {
        setOutRootPath(folderPath);
      }
    } else {
      const relPath = sampleFile.webkitRelativePath;
      const folderName = relPath ? relPath.split('/')[0] : (sampleFile.name || 'Dropped Folder');
      if (target === 'src') {
        setAttachedSrcInfo({ name: folderName, fileCount: files.length });
        if (!srcPath) setSrcPath(folderName);
      } else {
        if (!outRootPath) setOutRootPath(folderName);
      }
    }
  };

  // Import state
  const [baseDir, setBaseDir] = useState('');
  const [importCounts, setImportCounts] = useState({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Calibration state
  const [calCandidates, setCalCandidates] = useState([]);
  const [calSourceIdx, setCalSourceIdx] = useState(0);
  const [pts, setPts] = useState([]); // [[x,y], ...]
  const [calSaved, setCalSaved] = useState(false);
  const [calMode, setCalMode] = useState('photo-editor'); // 'photo-editor' | 'manual-dots'

  // Review / Candidates state
  const [candidatesData, setCandidatesData] = useState({}); // { depth: { seg_i: [ {filename, path, score, has_obstruction, obs_conf} ] } }
  const [candIdx, setCandIdx] = useState({}); // { "depth_seg": number }
  const [autoRejected, setAutoRejected] = useState([]);
  const [scoring, setScoring] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { depth, seg_i }
  const [autoDetect, setAutoDetect] = useState(true);
  const [customCrops, setCustomCrops] = useState({}); // { [photoFilename]: corners }
  const [calibratingPhoto, setCalibratingPhoto] = useState(null); // candidate object or null for single-photo modal
  const [slideLoading, setSlideLoading] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);

  const canvasRef = useRef(null);
  const [canvasImage, setCanvasImage] = useState(null);

  // Fetch initial sites from backend API (merging with default sites fallback)
  useEffect(() => {
    fetch('/api/sites')
      .then(async res => {
        if (res.ok) return await safeJson(res);
        throw new Error('API request failed');
      })
      .then(data => {
        if (data && data.sites && Object.keys(data.sites).length > 0) {
          setSitesMap(data.sites);
        }
      })
      .catch(err => console.log("Using default local sites map:", err));
  }, []);

  // Update site when location changes (only if currently selected site doesn't belong to new location)
  useEffect(() => {
    const list = sitesMap[selectedLoc] || [];
    if (list.length > 0) {
      const exists = list.some(s => s[0] === selectedSite?.[0] && s[1] === selectedSite?.[1]);
      if (!exists) {
        setSelectedSite(list[0]);
      }
    }
  }, [selectedLoc, sitesMap]);

  // Update survey export name (calculates local name + syncs with API)
  useEffect(() => {
    if (selectedSite) {
      const dateClean = (surveyDate || '').replace(/-/g, '');
      const fallbackName = `BS_${dateClean}_${selectedSite[1]}`;
      setSurveyName(fallbackName);

      fetch(`/api/survey-name?date_str=${surveyDate}&code=${selectedSite[1]}`)
        .then(async res => {
          if (res.ok) return await safeJson(res);
          throw new Error('API unavailable');
        })
        .then(data => { if (data && data.name) setSurveyName(data.name); })
        .catch(err => { /* fallbackName already set above */ });
    }
  }, [surveyDate, selectedSite]);

  // Ingest photos
  const handleImport = async () => {
    if (!srcPath || !outRootPath || !selectedSite) {
      alert("Please fill in source folder, output folder, and dive site!");
      return;
    }
    setImporting(true);
    setImportError('');
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          src_path: srcPath,
          out_root_path: outRootPath,
          location: selectedLoc,
          site_code: selectedSite[1],
          survey_date: surveyDate,
          depths: selectedDepths,
        })
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.detail || `Import failed (HTTP ${res.status})`);
      }
      setBaseDir(data.base_dir);
      setImportCounts(data.counts || {});
      setActiveTab('calibrate');
      loadCalCandidates(data.base_dir);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // Load calibration thumbnail candidates
  const loadCalCandidates = (bDir) => {
    const targetDir = bDir || baseDir;
    if (!targetDir) return;
    fetch(`/api/cal-candidates?base_dir=${encodeURIComponent(targetDir)}&depths=${selectedDepths.join(',')}`)
      .then(async res => {
        if (!res.ok) return { candidates: [] };
        return await safeJson(res);
      })
      .then(data => {
        if (data && data.candidates && data.candidates.length > 0) {
          setCalCandidates(data.candidates);
          setCalSourceIdx(0);
        }
      })
      .catch(err => console.error(err));
  };

  // Load selected calibration image into canvas
  useEffect(() => {
    if (activeTab === 'calibrate' && calCandidates.length > 0) {
      const chosen = calCandidates[calSourceIdx];
      if (chosen) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `/api/image/raw?path=${encodeURIComponent(chosen.path)}&w=800`;
        img.onload = () => {
          setCanvasImage(img);
        };
      }
    }
  }, [activeTab, calCandidates, calSourceIdx]);

  // Draw corner canvas overlay
  useEffect(() => {
    if (!canvasRef.current || !canvasImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvasImage.width;
    canvas.height = canvasImage.height;

    ctx.drawImage(canvasImage, 0, 0);

    // Draw connected quadrat quad lines if >= 2 points
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      if (pts.length === 4) {
        ctx.closePath();
      }
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (pts.length === 4) {
        ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
        ctx.fill();
      }
    }

    // Draw corner point circles and labels
    pts.forEach((pt, idx) => {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(`#${idx + 1} ${LABELS[idx]}`, pt[0] + 12, pt[1] + 4);
    });
  }, [canvasImage, pts]);

  // Handle canvas click to add corner
  const handleCanvasClick = (e) => {
    if (pts.length >= 4 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPts([...pts, [x, y]]);
  };

  // Save Calibration
  const saveCalibration = async () => {
    if (pts.length !== 4) return;
    // Scale corners back to original image scale if canvas display was scaled
    const chosen = calCandidates[calSourceIdx];
    try {
      const res = await fetch('/api/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_dir: baseDir,
          corners: pts,
          cal_source_depth: chosen ? chosen.depth : selectedDepths[0],
          cal_source_idx: calSourceIdx,
        })
      });
      const data = await safeJson(res);
      if (res.ok) {
        setCalSaved(true);
        alert("Quadrat calibration saved successfully!");
      } else {
        alert("Calibration save failed: " + (data.detail || res.statusText));
      }
    } catch (err) {
      alert("Calibration save error: " + err.message);
    }
  };

  // Build selection grid & calculate candidates
  const buildSelectionGrid = async () => {
    if (pts.length !== 4) {
      alert("Please complete the 4-click quadrat calibration first!");
      return;
    }
    setScoring(true);
    try {
      const res = await fetch(
        `/api/candidates?base_dir=${encodeURIComponent(baseDir)}` +
        `&depths=${selectedDepths.join(',')}` +
        `&corners_json=${encodeURIComponent(JSON.stringify(pts))}` +
        `&k=5&auto_detect=${autoDetect}`,
        { method: 'POST' }
      );
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.detail || `Scoring failed (HTTP ${res.status})`);
      setCandidatesData(data.segments || {});
      setAutoRejected(data.auto_rejected || []);
      setCandIdx({});

      // Pre-load any existing per-photo calibration overrides
      fetch(`/api/calibration?base_dir=${encodeURIComponent(baseDir)}`)
        .then(async r => { if (r.ok) return await safeJson(r); return {}; })
        .then(calData => {
          if (calData && calData.photo_overrides) {
            const loaded = {};
            Object.entries(calData.photo_overrides).forEach(([fn, v]) => {
              if (v && v.corners) loaded[fn] = v.corners;
            });
            setCustomCrops(loaded);
          }
        })
        .catch(err => console.error("Error loading photo overrides:", err));

      setActiveTab('review');
    } catch (err) {
      alert("Error scoring images: " + err.message);
    } finally {
      setScoring(false);
    }
  };

  // Reject current photo in lightbox / segment
  const handleReject = (depth, seg_i, candidate) => {
    const key = `${depth}_${seg_i}`;
    const pool = candidatesData[depth] ? candidatesData[depth][seg_i] : [];
    const currentIdx = candIdx[key] || 0;

    // Log decision
    fetch('/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_dir: baseDir,
        photo: candidate.filename,
        depth: parseInt(depth),
        segment: parseInt(seg_i),
        action: 'reject',
        score: candidate.score,
        obstruction_conf: candidate.obs_conf,
      })
    });

    // Advance to next candidate index if available
    if (currentIdx < pool.length - 1) {
      setSlideLoading(true);
      setCandIdx({ ...candIdx, [key]: currentIdx + 1 });
    } else {
      alert(`Segment ${parseInt(seg_i) + 1} has reached the end of candidates!`);
    }
  };

  // Keyboard navigation for Lightbox (Tinder Swipe style speed!)
  useEffect(() => {
    if (!lightbox) return;
    const { depth, seg_i } = lightbox;
    const key = `${depth}_${seg_i}`;
    const pool = candidatesData[depth] ? candidatesData[depth][seg_i] : [];
    const idx = candIdx[key] || 0;
    const currentCand = pool[idx];

    const handleKeyDown = (e) => {
      // Ignore if in photo editor modal
      if (calibratingPhoto) return;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        if (idx > 0) {
          setSlideLoading(true);
          setCandIdx({ ...candIdx, [key]: idx - 1 });
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (idx < pool.length - 1) {
          setSlideLoading(true);
          setCandIdx({ ...candIdx, [key]: idx + 1 });
        }
      } else if (e.key === 'x' || e.key === 'Delete' || e.key === 'Backspace') {
        if (currentCand) handleReject(depth, seg_i, currentCand);
      } else if (e.key === 'Escape') {
        setLightbox(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, candIdx, candidatesData, calibratingPhoto]);

  // Export survey
  const handleExport = async () => {
    if (!baseDir) return;
    setExporting(true);

    // Construct selection map
    const selection = {};
    selectedDepths.forEach(d => {
      const picks = [];
      for (let seg_i = 0; seg_i < 5; seg_i++) {
        const pool = candidatesData[d] ? candidatesData[d][seg_i] : [];
        if (pool && pool.length > 0) {
          const idx = candIdx[`${d}_${seg_i}`] || 0;
          picks.push(pool[Math.min(idx, pool.length - 1)].filename);
        }
      }
      selection[d] = picks;
    });

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          out_root_path: outRootPath,
          survey_name: surveyName,
          selection: selection,
          corners: pts,
          auto_detect: autoDetect,
          custom_corners: customCrops,
        })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.detail || `Export failed (HTTP ${res.status})`);
      setExportResult(data);
      alert(`Success! Exported ${data.count} photos to ${data.export_base}`);
    } catch (err) {
      alert("Export error: " + err.message);
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">B</div>
          <div>
            <h1 className="brand-title">IOP Benthic Survey Prep</h1>
            <p className="brand-subtitle">High-speed React + FastAPI automation prep tool</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            1. Ingest & Setup
          </button>
          <button
            className={`tab-btn ${activeTab === 'calibrate' ? 'active' : ''}`}
            onClick={() => setActiveTab('calibrate')}
          >
            2. Quadrat Calibration
          </button>
          <button
            className={`tab-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            3. Select & Export
          </button>
        </nav>
      </header>

      {/* Main App Workspace */}
      <main className="app-container">

        {/* TAB 1: IMPORT & SETUP */}
        {activeTab === 'import' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Project Setup & Folder Import</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <div className="form-group">
                  <label className="form-label">1. Project Location</label>
                  <select
                    className="form-select"
                    value={selectedLoc}
                    onChange={(e) => {
                      const newLoc = e.target.value;
                      setSelectedLoc(newLoc);
                      const list = sitesMap[newLoc] || [];
                      if (list.length > 0) {
                        setSelectedSite(list[0]);
                      }
                    }}
                  >
                    {Object.keys(sitesMap).map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">2. Dive Site</label>
                  <select
                    className="form-select"
                    value={
                      selectedSite
                        ? Math.max(0, (sitesMap[selectedLoc] || []).findIndex(s => s[0] === selectedSite[0] && s[1] === selectedSite[1]))
                        : 0
                    }
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      const list = sitesMap[selectedLoc] || [];
                      if (list[idx]) {
                        setSelectedSite(list[idx]);
                      }
                    }}
                  >
                    {(sitesMap[selectedLoc] || []).map((s, idx) => (
                      <option key={`${s[1]}_${idx}`} value={idx}>
                        {s[0]} ({s[1]}) — {s[2]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">3. Survey Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={surveyDate}
                    onChange={(e) => setSurveyDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Standardized Export Folder Name</label>
                  <div className="form-code">{surveyName || 'BS_YYYYMMDD_CODE'}</div>
                </div>

                {selectedSite && selectedSite[1] === 'BM' && (
                  <div className="alert-warning">
                    ⚠️ Code <strong>BM</strong> is shared by Batumulapan (Penida) and Blue Magic (Raja).
                    Recommend org rename one of the codes.
                  </div>
                )}
              </div>

              <div>
                <div className="form-group">
                  <label className="form-label">Source Folder Path (contains raw photos)</label>
                  <div
                    className={`input-with-actions ${isDraggingSrc ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingSrc(true); }}
                    onDragLeave={() => setIsDraggingSrc(false)}
                    onDrop={(e) => handleDrop(e, 'src')}
                  >
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. F:\Surveys\RawPhotos or attach/paste path..."
                      value={srcPath}
                      onChange={(e) => {
                        setSrcPath(e.target.value);
                        if (attachedSrcInfo && attachedSrcInfo.fullPath !== e.target.value) {
                          setAttachedSrcInfo(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleBrowseFolder('src')}
                      title="Open native OS folder explorer"
                    >
                      📁 Browse
                    </button>
                    <label className="btn btn-secondary attach-btn" title="Attach folder directly from browser">
                      📎 Attach Folder
                      <input
                        type="file"
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleFolderSelect(e, 'src')}
                      />
                    </label>
                  </div>
                  {attachedSrcInfo && (
                    <div className="attached-folder-badge">
                      <span>📂 Attached Folder: <strong>{attachedSrcInfo.name}</strong> {attachedSrcInfo.fileCount ? `(${attachedSrcInfo.fileCount} files found)` : ''}</span>
                      <button
                        type="button"
                        className="btn-icon-clear"
                        onClick={() => setAttachedSrcInfo(null)}
                        title="Clear attachment info"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <span className="input-hint">
                    💡 You can attach a folder, click 📁 Browse, drag & drop a folder, or manually copy/paste the path above.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Output Root Path (where survey folder will be saved)</label>
                  <div
                    className={`input-with-actions ${isDraggingOut ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOut(true); }}
                    onDragLeave={() => setIsDraggingOut(false)}
                    onDrop={(e) => handleDrop(e, 'out')}
                  >
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. F:\Surveys\Processed or attach/paste path..."
                      value={outRootPath}
                      onChange={(e) => setOutRootPath(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleBrowseFolder('out')}
                      title="Open native OS folder explorer"
                    >
                      📁 Browse
                    </button>
                    <label className="btn btn-secondary attach-btn" title="Attach folder directly from browser">
                      📎 Attach Folder
                      <input
                        type="file"
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleFolderSelect(e, 'out')}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Depths to Include (meters)</label>
                  <div className="checkbox-grid">
                    {ALL_DEPTHS.map(d => (
                      <div
                        key={d}
                        className={`checkbox-pill ${selectedDepths.includes(d) ? 'active' : ''}`}
                        onClick={() => {
                          if (selectedDepths.includes(d)) {
                            setSelectedDepths(selectedDepths.filter(x => x !== d));
                          } else {
                            setSelectedDepths([...selectedDepths, d].sort((a, b) => b - a));
                          }
                        }}
                      >
                        {d}m
                      </div>
                    ))}
                  </div>
                </div>

                {importError && (
                  <div className="alert-warning" style={{ color: 'var(--accent-rose)', borderColor: 'rgba(255,75,92,0.3)' }}>
                    ❌ {importError}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1.5rem', padding: '1rem' }}
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? 'Ingesting Photos...' : '🚀 Ingest Photos & Proceed to Calibration'}
                </button>
              </div>
            </div>
          </div>
        )
        }

        {/* TAB 2: QUADRAT CALIBRATION */}
        {
          activeTab === 'calibrate' && (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: 'var(--primary)' }}>Quadrat Frame Calibration (1:1 Square)</h2>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Camera is fixed to frame — calibrate once per survey. Retract or expand the square box, rotate using the degree ruler, or use arrow keys to crop precisely.
                  </p>
                </div>

                {/* Mode Selector */}
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.8)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                  <button
                    type="button"
                    className={`btn ${calMode === 'photo-editor' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => setCalMode('photo-editor')}
                  >
                    📷 Photo Editor (1:1 Square)
                  </button>
                  <button
                    type="button"
                    className={`btn ${calMode === 'manual-dots' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => setCalMode('manual-dots')}
                  >
                    🎯 Manual 4-Corner Dots
                  </button>
                </div>
              </div>

              {/* Step 1 Thumbnail Picker */}
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                Step 1 — Pick Calibration Image Source (Showing All 4 String Corners Clearly)
              </h3>
              <div className="cal-grid" style={{ marginBottom: '2rem' }}>
                {calCandidates.map((c, idx) => (
                  <div
                    key={c.filename}
                    className={`cal-thumb-card ${calSourceIdx === idx ? 'selected' : ''}`}
                    onClick={() => {
                      setCalSourceIdx(idx);
                      setPts([]);
                      setCalSaved(false);
                    }}
                  >
                    <img
                      src={`/api/image/raw?path=${encodeURIComponent(c.path)}&w=250`}
                      alt={c.filename}
                    />
                    <div className="cal-thumb-badge">#{idx + 1} ({c.depth}m)</div>
                  </div>
                ))}
              </div>

              {/* Step 2 Calibration Editor */}
              {calCandidates.length > 0 && calCandidates[calSourceIdx] ? (
                <div>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                    Step 2 — Adjust 1:1 Square Crop Box for Photo #{calSourceIdx + 1} ({calCandidates[calSourceIdx].filename})
                  </h3>

                  {calMode === 'photo-editor' ? (
                    <PhotoCropEditor
                      imageSrc={`/api/image/raw?path=${encodeURIComponent(calCandidates[calSourceIdx].path)}`}
                      initialCorners={pts.length === 4 ? pts : null}
                      onSaveCalibration={async ({ corners }) => {
                        setPts(corners);
                        const chosen = calCandidates[calSourceIdx];
                        try {
                          const res = await fetch('/api/calibrate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              base_dir: baseDir,
                              corners: corners,
                              cal_source_depth: chosen ? chosen.depth : selectedDepths[0],
                              cal_source_idx: calSourceIdx,
                            })
                          });
                          const data = await safeJson(res);
                          if (res.ok) {
                            setCalSaved(true);
                            alert("✅ 1:1 Quadrat calibration saved successfully!");
                          } else {
                            alert("Calibration save failed: " + (data.detail || res.statusText));
                          }
                        } catch (err) {
                          alert("Save error: " + err.message);
                        }
                      }}
                      onReset={() => {
                        setPts([]);
                        setCalSaved(false);
                      }}
                    />
                  ) : (
                    /* Legacy 4-Click Dot Calibration Mode */
                    <div>
                      <div className="corner-step-indicator">
                        {pts.length < 4 ? (
                          <>Next: Click <strong>{LABELS[pts.length]}</strong> corner point</>
                        ) : (
                          <>✅ All 4 corners calibrated! Save or proceed.</>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                        <div className="canvas-wrapper">
                          <canvas
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
                          <div style={{ background: 'rgba(15,23,42,0.8)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                            <h4>Corner Coordinates</h4>
                            <ul style={{ listStyle: 'none', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                              {LABELS.map((lbl, i) => (
                                <li key={lbl} style={{ padding: '0.25rem 0', color: pts[i] ? 'var(--primary)' : 'var(--text-dim)' }}>
                                  {i + 1}. {lbl}: {pts[i] ? `(${Math.round(pts[i][0])}, ${Math.round(pts[i][1])})` : 'Waiting click...'}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <button
                            className="btn btn-secondary"
                            onClick={() => setPts([])}
                            disabled={pts.length === 0}
                          >
                            🔄 Reset Clicked Points
                          </button>

                          <button
                            className="btn btn-primary"
                            onClick={saveCalibration}
                            disabled={pts.length !== 4}
                          >
                            💾 Save Calibration
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Proceed to Selection & Export Action Bar */}
                  <div
                    style={{
                      marginTop: '2rem',
                      padding: '1.25rem',
                      background: pts.length === 4 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                      border: `1px solid ${pts.length === 4 ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-glass)'}`,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ color: pts.length === 4 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                        {pts.length === 4 ? '✅ 1:1 Quadrat Calibration Ready' : 'ℹ️ Adjust & save calibration above before scoring'}
                      </strong>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                        Step 3 will rank candidates across all depths with heuristic scoring and YOLO obstruction detection.
                      </p>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{
                        background: pts.length === 4 ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.95rem',
                      }}
                      onClick={buildSelectionGrid}
                      disabled={pts.length !== 4 || scoring}
                    >
                      {scoring ? 'Scoring Photos...' : '⚡ Proceed to Selection & Export ›'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Please import survey photos in Tab 1 first to load calibration candidates.
                </div>
              )}
            </div>
          )
        }


        {/* TAB 3: SELECTION GRID & LIGHTBOX */}
        {
          activeTab === 'review' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: 'var(--primary)' }}>Photo Selection & Tinder Swipe Review</h2>
                  <p style={{ color: 'var(--text-muted)' }}>
                    Click 🔍 View on any segment for high-speed lightbox sliding & reject mode.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoDetect}
                      onChange={(e) => setAutoDetect(e.target.checked)}
                    />
                    Auto-detect string corners
                  </label>

                  <button
                    className="btn btn-primary"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    {exporting ? 'Exporting...' : '📦 Export Final Survey'}
                  </button>
                </div>
              </div>

              {/* LIGHTBOX MODAL / VIEWPORT */}
              {lightbox && (
                <div className="lightbox-container" style={{ marginBottom: '2rem' }}>
                  <div>
                    {(() => {
                      const { depth, seg_i } = lightbox;
                      const pool = candidatesData[depth] ? candidatesData[depth][seg_i] : [];
                      const idx = candIdx[`${depth}_${seg_i}`] || 0;
                      const candidate = pool[idx];

                      if (!candidate) return <p>No candidate available</p>;

                      const activeCorners = customCrops[candidate.filename] || pts;
                      const hasCustomCrop = Boolean(customCrops[candidate.filename]);

                      return (
                        <div>
                          <div className="lightbox-viewport">
                            {slideLoading && (
                              <div className="lightbox-loading-overlay">
                                <div className="spinner-ring"></div>
                                <span>Loading picture...</span>
                              </div>
                            )}

                            <img
                              key={`${candidate.filename}_${hasCustomCrop ? 'custom' : 'default'}`}
                              className={`lightbox-slide-img ${slideLoading ? 'img-loading' : 'img-loaded'}`}
                              src={`/api/image/warped?path=${encodeURIComponent(candidate.path)}&corners_json=${encodeURIComponent(JSON.stringify(activeCorners))}&size=600&auto_detect=${hasCustomCrop ? false : autoDetect}`}
                              alt={candidate.filename}
                              onLoad={() => setSlideLoading(false)}
                            />

                            <button
                              className="reject-overlay-btn"
                              title="Reject candidate"
                              onClick={() => handleReject(depth, seg_i, candidate)}
                            >
                              ✕
                            </button>

                            {hasCustomCrop && (
                              <div className="custom-crop-badge-overlay">
                                ⭐ Custom Wall / Angle Crop Applied
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.75rem' }}>
                            <button
                              className="btn btn-secondary"
                              disabled={idx === 0}
                              onClick={() => {
                                setSlideLoading(true);
                                setCandIdx({ ...candIdx, [`${depth}_${seg_i}`]: idx - 1 });
                              }}
                            >
                              ‹ Slide Left
                            </button>

                            <button
                              className="btn btn-danger"
                              onClick={() => handleReject(depth, seg_i, candidate)}
                            >
                              ❌ Reject & Next Best
                            </button>

                            <button
                              className="btn btn-secondary"
                              disabled={idx === pool.length - 1}
                              onClick={() => {
                                setSlideLoading(true);
                                setCandIdx({ ...candIdx, [`${depth}_${seg_i}`]: idx + 1 });
                              }}
                            >
                              Slide Right ›
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Lightbox Side Panel */}
                  {(() => {
                    const { depth, seg_i } = lightbox;
                    const pool = candidatesData[depth] ? candidatesData[depth][seg_i] : [];
                    const idx = candIdx[`${depth}_${seg_i}`] || 0;
                    const candidate = pool[idx];
                    const hasCustomCrop = candidate ? Boolean(customCrops[candidate.filename]) : false;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '1rem' }}>
                          <h3>Depth {depth}m — Segment {parseInt(seg_i) + 1}</h3>
                          <p className="brand-subtitle">Candidate {idx + 1} of {pool.length}</p>
                        </div>

                        {/* Per-Photo Calibration Card */}
                        {candidate && (
                          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.9rem' }}>Single-Photo Calibration</strong>
                              {hasCustomCrop ? (
                                <span className="badge-tag-green">⭐ Custom</span>
                              ) : (
                                <span className="badge-tag-dim">Survey Default</span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {hasCustomCrop
                                ? 'Custom 1:1 crop/rotation is applied specifically to this photo.'
                                : 'If the diver was on a wall or current, re-calibrate/rotate (90°/180°) for this photo only.'}
                            </p>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#000', fontWeight: 600, padding: '0.6rem', fontSize: '0.85rem' }}
                              onClick={() => setCalibratingPhoto(candidate)}
                            >
                              📐 {hasCustomCrop ? 'Edit Custom Crop & Rotation' : 'Re-Calibrate / Rotate for Wall'}
                            </button>
                            {hasCustomCrop && (
                              <button
                                type="button"
                                className="btn-text-reset"
                                style={{ alignSelf: 'center', fontSize: '0.75rem', marginTop: '0.2rem' }}
                                onClick={() => {
                                  setCustomCrops(prev => {
                                    const next = { ...prev };
                                    delete next[candidate.filename];
                                    return next;
                                  });
                                  setSlideLoading(true);
                                }}
                              >
                                ↺ Revert to Survey Default Crop
                              </button>
                            )}
                          </div>
                        )}

                        {candidate && (
                          <div className="glass-panel" style={{ padding: '1rem', fontSize: '0.9rem' }}>
                            <p><strong>File:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{candidate.filename}</span></p>
                            <p style={{ marginTop: '0.5rem' }}><strong>Score:</strong> {candidate.score.toFixed(3)}</p>

                            {candidate.has_obstruction && (
                              <div className="metric-badge badge-red" style={{ marginTop: '0.75rem' }}>
                                ⚠️ Obstruction detected ({Math.round(candidate.obs_conf * 100)}%)
                              </div>
                            )}
                          </div>
                        )}

                        <div className="shortcut-hints" style={{ flexDirection: 'column' }}>
                          <p><strong>⚡ Keyboard Speed Shortcuts:</strong></p>
                          <p><span className="kbd-badge">←</span> / <span className="kbd-badge">A</span> Slide prev candidate</p>
                          <p><span className="kbd-badge">→</span> / <span className="kbd-badge">D</span> Slide next candidate</p>
                          <p><span className="kbd-badge">X</span> / <span className="kbd-badge">Del</span> Reject current photo</p>
                          <p><span className="kbd-badge">Esc</span> Back to grid</p>
                        </div>

                        <button className="btn btn-secondary" onClick={() => setLightbox(null)}>
                          ✕ Close Lightbox
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SELECTION GRID PER DEPTH */}
              {selectedDepths.map(d => (
                <div key={d} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                    Depth {d} meters
                  </h3>

                  <div className="segment-grid">
                    {[0, 1, 2, 3, 4].map(seg_i => {
                      const pool = candidatesData[d] ? candidatesData[d][seg_i] : [];
                      const idx = candIdx[`${d}_${seg_i}`] || 0;
                      const candidate = pool[Math.min(idx, pool.length - 1)];

                      const activeCorners = candidate ? (customCrops[candidate.filename] || pts) : pts;
                      const hasCustomCrop = candidate ? Boolean(customCrops[candidate.filename]) : false;

                      return (
                        <div key={seg_i} className="segment-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600' }}>
                            <span>Seg {seg_i + 1}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({pool.length} left)</span>
                          </div>

                          {candidate ? (
                            <>
                              <div style={{ position: 'relative' }}>
                                <img
                                  src={`/api/image/warped?path=${encodeURIComponent(candidate.path)}&corners_json=${encodeURIComponent(JSON.stringify(activeCorners))}&size=250&auto_detect=${hasCustomCrop ? false : autoDetect}`}
                                  alt={candidate.filename}
                                />
                                {hasCustomCrop && (
                                  <div className="custom-crop-badge-overlay" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', bottom: '6px', left: '6px' }}>
                                    ⭐ Custom Crop
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {candidate.filename}
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    setSlideLoading(true);
                                    setLightbox({ depth: d, seg_i });
                                  }}
                                >
                                  🔍 View & Slide
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                  title="Custom Re-Calibrate / Rotate crop for this photo only"
                                  onClick={() => setCalibratingPhoto(candidate)}
                                >
                                  📐
                                </button>
                              </div>
                            </>
                          ) : (
                            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
                              None available
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            </div>
          )
        }

        {/* SINGLE-PHOTO CUSTOM CALIBRATION MODAL */}
        {calibratingPhoto && (
          <div className="modal-backdrop">
            <div className="modal-content glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>
                    📐 Custom Quadrat Crop & Rotation — {calibratingPhoto.filename}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Adjust the 1:1 square crop or rotate (e.g. 90°/180° for reef walls & currents) for <strong>this specific picture only</strong>. It will not affect the rest of the survey.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-icon-clear"
                  style={{ fontSize: '1.5rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setCalibratingPhoto(null)}
                >
                  ✕
                </button>
              </div>

              <PhotoCropEditor
                imageSrc={`/api/image/raw?path=${encodeURIComponent(calibratingPhoto.path)}`}
                initialCorners={customCrops[calibratingPhoto.filename] || pts}
                saveButtonLabel="💾 Save Crop for This Picture"
                onCancel={() => setCalibratingPhoto(null)}
                onSaveCalibration={async ({ corners, cropBox }) => {
                  setCustomCrops(prev => ({ ...prev, [calibratingPhoto.filename]: corners }));
                  try {
                    await fetch('/api/calibrate-photo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        base_dir: baseDir,
                        photo: calibratingPhoto.filename,
                        corners: corners,
                        crop_box: cropBox
                      })
                    });
                  } catch (e) {
                    console.error("Save photo calibration error:", e);
                  }
                  setCalibratingPhoto(null);
                  setSlideLoading(true);
                }}
                onReset={() => {
                  setCustomCrops(prev => {
                    const next = { ...prev };
                    delete next[calibratingPhoto.filename];
                    return next;
                  });
                }}
              />
            </div>
          </div>
        )}
      </main>

    </div >
  );
}
