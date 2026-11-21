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
  // 5-Step Pipeline: 'import' -> 'pick' -> 'calibrate' -> 'review' -> 'export'
  const [activeTab, setActiveTab] = useState('import');

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

  // Ingest state & progress
  const [baseDir, setBaseDir] = useState('');
  const [importCounts, setImportCounts] = useState({});
  const [importing, setImporting] = useState(false);
  const [importElapsed, setImportElapsed] = useState(0);
  const [importError, setImportError] = useState('');

  // Step 2: Manual Pick state
  const [depthPhotos, setDepthPhotos] = useState({}); // { [depth]: [ {filename, path} ] }
  const [selectedPhotos, setSelectedPhotos] = useState({}); // { [depth]: [ filename1, filename2, ... (max 5) ] }
  const [activePickDepth, setActivePickDepth] = useState(25);
  const [loadingDepthPhotos, setLoadingDepthPhotos] = useState(false);

  // Step 3: 1st Quadrat Calibration state
  const [calSourceDepth, setCalSourceDepth] = useState(25);
  const [calSourcePhoto, setCalSourcePhoto] = useState(null);
  const [pts, setPts] = useState([]); // 4 points: [[x,y], ...]
  const [calSaved, setCalSaved] = useState(false);
  const [calMode, setCalMode] = useState('photo-editor'); // 'photo-editor' | 'manual-dots'
  const [savingCal, setSavingCal] = useState(false);
  const canvasRef = useRef(null);
  const [canvasImage, setCanvasImage] = useState(null);

  // Step 4: View & Slide, Depth Calibration & Single-Photo Override
  const [depthCrops, setDepthCrops] = useState({}); // { [depth]: corners }
  const [customCrops, setCustomCrops] = useState({}); // { [filename]: corners }
  const [calibratingDepth, setCalibratingDepth] = useState(null); // depth number or null
  const [calibratingPhoto, setCalibratingPhoto] = useState(null); // photo object or null
  const [lightbox, setLightbox] = useState(null); // { depth, slotIdx }
  const [slideLoading, setSlideLoading] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);

  // Step 5: Export state & live progress
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null); // { current, total, filename, depth, elapsed, status }
  const [exportResult, setExportResult] = useState(null);

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

  // Fetch initial sites from backend API
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

  // Update site when location changes
  useEffect(() => {
    const list = sitesMap[selectedLoc] || [];
    if (list.length > 0) {
      const exists = list.some(s => s[0] === selectedSite?.[0] && s[1] === selectedSite?.[1]);
      if (!exists) {
        setSelectedSite(list[0]);
      }
    }
  }, [selectedLoc, sitesMap]);

  // Update survey export name
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
        .catch(err => { /* fallback */ });
    }
  }, [surveyDate, selectedSite]);

  // Timer for ingest progress animation
  useEffect(() => {
    let timer = null;
    if (importing) {
      setImportElapsed(0);
      timer = setInterval(() => setImportElapsed(prev => prev + 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [importing]);

  // Load photos per depth for manual gallery
  const loadDepthPhotos = async (bDir) => {
    const targetDir = bDir || baseDir;
    if (!targetDir) return;
    setLoadingDepthPhotos(true);
    try {
      const res = await fetch(`/api/depth-photos?base_dir=${encodeURIComponent(targetDir)}&depths=${selectedDepths.join(',')}`);
      const data = await safeJson(res);
      if (res.ok && data.photos) {
        // Guarantee no duplicated filenames in any depth
        const cleanPhotos = {};
        Object.entries(data.photos).forEach(([d, list]) => {
          const seen = new Set();
          cleanPhotos[d] = (list || []).filter(p => {
            const key = (p.filename || '').toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        setDepthPhotos(cleanPhotos);

        // Ensure every depth has an array in selectedPhotos
        setSelectedPhotos(prev => {
          const next = { ...prev };
          selectedDepths.forEach(d => {
            if (!next[d]) next[d] = [];
          });
          return next;
        });
        if (!selectedDepths.includes(activePickDepth)) {
          setActivePickDepth(selectedDepths[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load depth photos:", err);
    } finally {
      setLoadingDepthPhotos(false);
    }
  };

  // Load existing survey calibration
  const loadCalibration = async (bDir) => {
    const targetDir = bDir || baseDir;
    if (!targetDir) return;
    try {
      const res = await fetch(`/api/calibration?base_dir=${encodeURIComponent(targetDir)}`);
      const data = await safeJson(res);
      if (res.ok && data) {
        if (data.corners && Array.isArray(data.corners) && data.corners.length === 4) {
          setPts(data.corners);
          setCalSaved(true);
        }
        if (data.depth_overrides) {
          const depthMap = {};
          Object.entries(data.depth_overrides).forEach(([k, v]) => {
            if (v && v.corners) depthMap[k] = v.corners;
          });
          setDepthCrops(depthMap);
        }
        if (data.photo_overrides) {
          const photoMap = {};
          Object.entries(data.photo_overrides).forEach(([k, v]) => {
            if (v && v.corners) photoMap[k] = v.corners;
          });
          setCustomCrops(photoMap);
        }
      }
    } catch (err) {
      console.error("Failed to load calibration:", err);
    }
  };

  // STEP 1: Ingest Photos
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
      await loadDepthPhotos(data.base_dir);
      await loadCalibration(data.base_dir);
      setActiveTab('pick');
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // STEP 2: Toggle photo selection in Manual Pick Gallery
  const handleTogglePhotoPick = (depth, filename) => {
    setSelectedPhotos(prev => {
      const current = prev[depth] || [];
      if (current.includes(filename)) {
        // Undo / unselect
        return { ...prev, [depth]: current.filter(f => f !== filename) };
      } else {
        // Add if less than 5
        if (current.length >= 5) {
          alert(`Depth ${depth}m already has 5 photos selected! Click a selected photo to unpick it first.`);
          return prev;
        }
        return { ...prev, [depth]: [...current, filename] };
      }
    });
  };

  // Evenly space 5 photos across the list for a depth
  const handleEvenlyPick5 = (depth) => {
    const list = depthPhotos[depth] || [];
    if (list.length === 0) return;
    if (list.length <= 5) {
      setSelectedPhotos(prev => ({ ...prev, [depth]: list.map(p => p.filename) }));
      return;
    }
    // Calculate 5 evenly distributed indices
    const indices = [0, 1, 2, 3, 4].map(i => Math.min(list.length - 1, Math.round(i * (list.length - 1) / 4)));
    const picked = indices.map(idx => list[idx].filename);
    setSelectedPhotos(prev => ({ ...prev, [depth]: picked }));
  };

  // Clear picks for a depth
  const handleClearDepthPicks = (depth) => {
    setSelectedPhotos(prev => ({ ...prev, [depth]: [] }));
  };

  // Check if all selected depths have 5 picks
  const allDepthsHave5 = selectedDepths.length > 0 && selectedDepths.every(d => (selectedPhotos[d] || []).length === 5);

  // Initialize calibration source photo when entering Step 3
  useEffect(() => {
    if (activeTab === 'calibrate') {
      if (!calSourcePhoto) {
        // Default to first selected photo from shallowest or deepest depth
        for (const d of selectedDepths) {
          const picks = selectedPhotos[d] || [];
          if (picks.length > 0) {
            const pool = depthPhotos[d] || [];
            const found = pool.find(p => p.filename === picks[0]);
            if (found) {
              setCalSourcePhoto(found);
              break;
            }
          }
        }
      }
    }
  }, [activeTab, selectedDepths, selectedPhotos, depthPhotos, calSourcePhoto]);

  // Load selected calibration image into canvas (for manual dots mode)
  useEffect(() => {
    if (activeTab === 'calibrate' && calSourcePhoto && calMode === 'manual-dots') {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `/api/image/raw?path=${encodeURIComponent(calSourcePhoto.path)}&w=800`;
      img.onload = () => setCanvasImage(img);
    }
  }, [activeTab, calSourcePhoto, calMode]);

  // Draw manual dots canvas overlay
  useEffect(() => {
    if (!canvasRef.current || !canvasImage || calMode !== 'manual-dots') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvasImage.width;
    canvas.height = canvasImage.height;
    ctx.drawImage(canvasImage, 0, 0);

    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      if (pts.length === 4) ctx.closePath();
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (pts.length === 4) {
        ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
        ctx.fill();
      }
    }

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
  }, [canvasImage, pts, calMode]);

  const handleCanvasClick = (e) => {
    if (pts.length >= 4 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPts([...pts, [x, y]]);
  };

  // Save 1st global calibration
  const saveGlobalCalibration = async (cornersToSave) => {
    const finalPts = cornersToSave || pts;
    if (!finalPts || finalPts.length !== 4) return;
    setSavingCal(true);
    try {
      const res = await fetch('/api/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_dir: baseDir,
          corners: finalPts,
          cal_source_depth: calSourcePhoto ? calSourcePhoto.depth : selectedDepths[0],
          cal_source_idx: 0,
        })
      });
      const data = await safeJson(res);
      if (res.ok) {
        setPts(finalPts);
        setCalSaved(true);
        alert("✅ Survey 1st quadrat calibration saved successfully!");
      } else {
        alert("Calibration save failed: " + (data.detail || res.statusText));
      }
    } catch (err) {
      alert("Calibration save error: " + err.message);
    } finally {
      setSavingCal(false);
    }
  };

  // STEP 4: Resolve active corners for a photo (Hierarchy: Custom Photo > Custom Depth > Global Survey)
  const getActiveCornersForPhoto = (depth, filename) => {
    if (customCrops[filename]) return customCrops[filename];
    if (depthCrops[depth]) return depthCrops[depth];
    return pts;
  };

  // Lightbox keyboard controls
  useEffect(() => {
    if (!lightbox) return;
    const { depth, slotIdx } = lightbox;
    const currentPicks = selectedPhotos[depth] || [];
    const currentPhotoName = currentPicks[slotIdx];
    const allDepthList = depthPhotos[depth] || [];
    // Unused pool + current photo
    const candidatePool = allDepthList.filter(p => !currentPicks.includes(p.filename) || p.filename === currentPhotoName);
    const currentCandidateIdx = Math.max(0, candidatePool.findIndex(p => p.filename === currentPhotoName));

    const handleKeyDown = (e) => {
      // Don't intercept if crop editor modal is open
      if (calibratingPhoto || calibratingDepth) return;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        if (candidatePool.length > 1) {
          const nextIdx = (currentCandidateIdx - 1 + candidatePool.length) % candidatePool.length;
          const nextPhoto = candidatePool[nextIdx];
          handleSwapSlotCandidate(depth, slotIdx, nextPhoto.filename);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (candidatePool.length > 1) {
          const nextIdx = (currentCandidateIdx + 1) % candidatePool.length;
          const nextPhoto = candidatePool[nextIdx];
          handleSwapSlotCandidate(depth, slotIdx, nextPhoto.filename);
        }
      } else if (e.key === 'Escape') {
        setLightbox(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, selectedPhotos, depthPhotos, calibratingPhoto, calibratingDepth]);

  // Swap candidate for a slot in lightbox
  const handleSwapSlotCandidate = (depth, slotIdx, newFilename) => {
    setSlideLoading(true);
    setSelectedPhotos(prev => {
      const picks = [...(prev[depth] || [])];
      picks[slotIdx] = newFilename;
      return { ...prev, [depth]: picks };
    });
  };

  // Save depth-wide custom calibration
  const saveDepthCalibration = async (depth, corners) => {
    try {
      await fetch('/api/calibrate-depth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_dir: baseDir,
          depth: parseInt(depth, 10),
          corners: corners,
        })
      });
      setDepthCrops(prev => ({ ...prev, [depth]: corners }));
      setCalibratingDepth(null);
      alert(`✅ Custom calibration saved for all photos at Depth ${depth}m!`);
    } catch (err) {
      alert("Failed to save depth calibration: " + err.message);
    }
  };

  // Revert depth calibration to global
  const resetDepthCalibration = async (depth) => {
    setDepthCrops(prev => {
      const next = { ...prev };
      delete next[depth];
      return next;
    });
  };

  // STEP 5: Run Export with Live Polling & Progress Bar
  const handleExport = async () => {
    if (!baseDir) return;
    setExporting(true);
    setExportProgress({ current: 0, total: selectedDepths.length * 5, elapsed: 0, filename: '', status: 'running' });

    // Poll progress endpoint
    const pollInterval = setInterval(async () => {
      try {
        const pRes = await fetch('/api/export-progress');
        if (pRes.ok) {
          const prog = await safeJson(pRes);
          if (prog && prog.status) {
            setExportProgress(prog);
            if (prog.status === 'done' || prog.status === 'error') {
              clearInterval(pollInterval);
            }
          }
        }
      } catch (e) {
        // ignore poll errors
      }
    }, 350);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          out_root_path: outRootPath,
          survey_name: surveyName,
          selection: selectedPhotos,
          corners: pts,
          auto_detect: autoDetect,
          custom_corners: customCrops,
          depth_corners: depthCrops,
        })
      });
      const data = await safeJson(res);
      clearInterval(pollInterval);
      if (!res.ok) throw new Error(data.detail || `Export failed (HTTP ${res.status})`);
      setExportResult(data);
      setExportProgress(prev => ({ ...prev, status: 'done', current: data.count, total: data.count }));
    } catch (err) {
      clearInterval(pollInterval);
      setExportProgress(prev => ({ ...prev, status: 'error', error: err.message }));
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
            <p className="brand-subtitle">V0.2.1 — Fast Manual Selection & Depth Calibration</p>
          </div>
        </div>

        {/* 5-Step Pipeline Navigation */}
        <nav className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            1. Ingest & Setup
          </button>
          <button
            className={`tab-btn ${activeTab === 'pick' ? 'active' : ''}`}
            onClick={() => {
              if (!baseDir) {
                alert("Please complete step 1 (Ingest photos) first!");
                return;
              }
              setActiveTab('pick');
            }}
          >
            2. Manual Pick
          </button>
          <button
            className={`tab-btn ${activeTab === 'calibrate' ? 'active' : ''}`}
            onClick={() => {
              if (!baseDir) {
                alert("Please complete step 1 (Ingest photos) first!");
                return;
              }
              setActiveTab('calibrate');
            }}
          >
            3. 1st Calibration
          </button>
          <button
            className={`tab-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => {
              if (pts.length !== 4) {
                alert("Please complete 1st Quadrat Calibration in step 3 first!");
                return;
              }
              setActiveTab('review');
            }}
          >
            4. View & Slide / Adjust
          </button>
          <button
            className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => {
              if (pts.length !== 4) {
                alert("Please complete calibration first!");
                return;
              }
              setActiveTab('export');
            }}
          >
            5. Select & Export
          </button>
        </nav>
      </header>

      {/* Main App Workspace */}
      <main className="app-container">

        {/* =========================================================================
            STEP 1: INGEST & SETUP
            ========================================================================= */}
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
                      if (list.length > 0) setSelectedSite(list[0]);
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
                      if (list[idx]) setSelectedSite(list[idx]);
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
                      <span>📂 Attached: <strong>{attachedSrcInfo.name}</strong> {attachedSrcInfo.fileCount ? `(${attachedSrcInfo.fileCount} files)` : ''}</span>
                      <button
                        type="button"
                        className="btn-icon-clear"
                        onClick={() => setAttachedSrcInfo(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <span className="input-hint">
                    💡 You can attach a folder, click 📁 Browse, drag & drop a folder, or manually copy/paste the path.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Output Root Path (where survey will be saved)</label>
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
                  style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', fontSize: '1rem' }}
                  onClick={handleImport}
                  disabled={importing}
                >
                  🚀 Ingest Photos & Open Manual Gallery ›
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 2: MANUAL PICK GALLERY (Reverting YOLO autopick)
            ========================================================================= */}
        {activeTab === 'pick' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: 'var(--primary)' }}>Manual Photo Selection Gallery</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Pick exactly <strong>5 photos per depth</strong> for the survey. Click any photo thumbnail to select or undo choice.
                </p>
              </div>

              {/* Action buttons for active depth */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleEvenlyPick5(activePickDepth)}
                  title="Evenly select 5 photos across this depth's folder"
                >
                  ⚡ Evenly Pick 5 Photos
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleClearDepthPicks(activePickDepth)}
                  title="Clear all selections for this depth"
                >
                  ↺ Reset Picks
                </button>
              </div>
            </div>

            {/* Depth Selector Tabs with Selection Counters */}
            <div className="depth-selector-bar">
              {selectedDepths.map(d => {
                const count = (selectedPhotos[d] || []).length;
                const isComplete = count === 5;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`depth-selector-tab ${activePickDepth === d ? 'active' : ''}`}
                    onClick={() => setActivePickDepth(d)}
                  >
                    <span>Depth {d}m</span>
                    <span
                      className="depth-pill-count"
                      style={{
                        background: isComplete ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                        color: isComplete ? '#6ee7b7' : '#fcd34d',
                      }}
                    >
                      {count} / 5 {isComplete ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Depth Photo Gallery */}
            {loadingDepthPhotos ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--primary)' }}>
                <div className="spinner-ring" style={{ margin: '0 auto 1rem' }}></div>
                <p>Loading photo previews for Depth {activePickDepth}m...</p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      📁 Depth {activePickDepth}m Photos
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                      (Folder: <code style={{ color: 'var(--primary)' }}>reserved/{activePickDepth}m/</code> — {(depthPhotos[activePickDepth] || []).length} pictures, only for this depth)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: (selectedPhotos[activePickDepth] || []).length === 5 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                        background: (selectedPhotos[activePickDepth] || []).length === 5 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '9999px',
                        border: `1px solid ${(selectedPhotos[activePickDepth] || []).length === 5 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      }}
                    >
                      Depth {activePickDepth}m: {(selectedPhotos[activePickDepth] || []).length} / 5 Chosen
                    </span>

                    {(selectedPhotos[activePickDepth] || []).length === 5 && (() => {
                      const nextUnfinished = selectedDepths.find(d => (selectedPhotos[d] || []).length < 5);
                      if (nextUnfinished) {
                        return (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
                            onClick={() => setActivePickDepth(nextUnfinished)}
                          >
                            Next: Depth {nextUnfinished}m ›
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="gallery-grid">
                  {(depthPhotos[activePickDepth] || []).map((photo) => {
                    const depthPicks = selectedPhotos[activePickDepth] || [];
                    const selIdx = depthPicks.indexOf(photo.filename);
                    const isSelected = selIdx !== -1;

                    return (
                      <div
                        key={photo.filename}
                        className={`gallery-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleTogglePhotoPick(activePickDepth, photo.filename)}
                      >
                        <div className="gallery-card-thumb-wrapper">
                          <img
                            src={`/api/image/raw?path=${encodeURIComponent(photo.path)}&w=350`}
                            alt={photo.filename}
                            loading="lazy"
                          />
                          {isSelected ? (
                            <div className="gallery-selection-badge">#{selIdx + 1}</div>
                          ) : (
                            <div className="gallery-unselected-indicator">+</div>
                          )}
                        </div>
                        <div className="gallery-card-info" title={photo.filename}>
                          {photo.filename}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Proceed to 1st Calibration Action Bar */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem 1.5rem',
                background: allDepthsHave5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${allDepthsHave5 ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-glass)'}`,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <strong style={{ color: allDepthsHave5 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                  {allDepthsHave5 ? '✅ All depths have 5 photos selected!' : 'ℹ️ Select 5 photos for every included depth'}
                </strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  Depths ready: {selectedDepths.filter(d => (selectedPhotos[d] || []).length === 5).length} of {selectedDepths.length}
                </p>
              </div>

              <button
                className="btn btn-primary"
                style={{
                  background: allDepthsHave5 ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                  padding: '0.75rem 1.75rem',
                  fontSize: '0.95rem',
                }}
                disabled={!allDepthsHave5}
                onClick={() => setActiveTab('calibrate')}
              >
                ⚡ Proceed to 1st Quadrat Calibration ›
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 3: 1ST QUADRAT CALIBRATION
            ========================================================================= */}
        {activeTab === 'calibrate' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: 'var(--primary)' }}>Quadrat Frame Calibration (1:1 Square)</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Camera is fixed to frame — calibrate once for the survey. Drag square handles or adjust ruler rotation.
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

            {/* Source Photo Selector (Grouped per depth) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                Pick Calibration Source Picture from Depth:
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing chosen photos for Depth {calSourceDepth}m
              </span>
            </div>

            {/* Depth Filter Tabs for Calibration Image */}
            <div className="depth-selector-bar" style={{ marginBottom: '1rem' }}>
              {selectedDepths.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`depth-selector-tab ${calSourceDepth === d ? 'active' : ''}`}
                  onClick={() => {
                    setCalSourceDepth(d);
                    const picks = selectedPhotos[d] || [];
                    if (picks.length > 0) {
                      const pool = depthPhotos[d] || [];
                      const found = pool.find(p => p.filename === picks[0]);
                      if (found) {
                        setCalSourcePhoto(found);
                        setCalSaved(false);
                      }
                    }
                  }}
                >
                  <span>Depth {d}m</span>
                  <span className="depth-pill-count">
                    {(selectedPhotos[d] || []).length} photos
                  </span>
                </button>
              ))}
            </div>

            <div className="cal-grid" style={{ marginBottom: '2rem' }}>
              {(selectedPhotos[calSourceDepth] || []).map(fn => {
                const pool = depthPhotos[calSourceDepth] || [];
                return pool.find(p => p.filename === fn) || { filename: fn, depth: calSourceDepth, path: '' };
              }).map((photo) => (
                <div
                  key={photo.filename}
                  className={`cal-thumb-card ${calSourcePhoto?.filename === photo.filename ? 'selected' : ''}`}
                  onClick={() => {
                    setCalSourcePhoto(photo);
                    setCalSaved(false);
                  }}
                >
                  <img
                    src={`/api/image/raw?path=${encodeURIComponent(photo.path)}&w=250`}
                    alt={photo.filename}
                  />
                  <div className="cal-thumb-badge">Depth {calSourceDepth}m</div>
                  <div style={{ fontSize: '0.75rem', padding: '0.4rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {photo.filename}
                  </div>
                </div>
              ))}
            </div>

            {/* Calibration Workspace */}
            {calSourcePhoto && (
              <div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                  Adjust 1:1 Square Crop for {calSourcePhoto.filename}
                </h3>

                {calMode === 'photo-editor' ? (
                  <PhotoCropEditor
                    imageSrc={`/api/image/raw?path=${encodeURIComponent(calSourcePhoto.path)}`}
                    initialCorners={pts.length === 4 ? pts : null}
                    onSaveCalibration={async ({ corners }) => {
                      await saveGlobalCalibration(corners);
                    }}
                    onReset={() => {
                      setPts([]);
                      setCalSaved(false);
                    }}
                  />
                ) : (
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
                        <canvas ref={canvasRef} onClick={handleCanvasClick} />
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
                          🔄 Reset Points
                        </button>

                        <button
                          className="btn btn-primary"
                          onClick={() => saveGlobalCalibration(pts)}
                          disabled={pts.length !== 4 || savingCal}
                        >
                          {savingCal ? 'Saving...' : '💾 Save Calibration'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Proceed Action Bar */}
                <div
                  style={{
                    marginTop: '2rem',
                    padding: '1.25rem 1.5rem',
                    background: pts.length === 4 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${pts.length === 4 ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-glass)'}`,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <strong style={{ color: pts.length === 4 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {pts.length === 4 ? '✅ 1:1 Quadrat Calibration Ready' : 'ℹ️ Save 4-corner calibration above before review'}
                    </strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                      Step 4 lets you slide candidate photos, calibrate specific depths, or adjust single photos.
                    </p>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{
                      background: pts.length === 4 ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                      padding: '0.75rem 1.75rem',
                      fontSize: '0.95rem',
                    }}
                    onClick={() => setActiveTab('review')}
                    disabled={pts.length !== 4}
                  >
                    ⚡ Proceed to View & Slide / Adjust ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 4: VIEW & SLIDE / RE-CALIBRATE PER DEPTH & PHOTO
            ========================================================================= */}
        {activeTab === 'review' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ color: 'var(--primary)' }}>View & Slide Review</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  Click <strong>🔍 View & Slide</strong> to swap photos with unused candidates, or <strong>📐 Calibrate Depth</strong> to adjust an entire depth.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveTab('export')}
                >
                  📦 Proceed to Final Export ›
                </button>
              </div>
            </div>

            {/* Depth Groups */}
            {selectedDepths.map(d => {
              const currentPicks = selectedPhotos[d] || [];
              const allDepthList = depthPhotos[d] || [];
              const unusedCount = Math.max(0, allDepthList.length - currentPicks.length);
              const hasDepthCal = Boolean(depthCrops[d]);

              return (
                <div key={d} className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                  {/* Depth Header with Calibration Button */}
                  <div className="depth-header-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>
                        Depth {d} meters
                      </h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        ({unusedCount} replacement photos available)
                      </span>
                      {hasDepthCal && (
                        <span className="badge-depth-cal">
                          ⭐ Depth Calibration Active ({d}m)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', borderColor: hasDepthCal ? 'rgba(192, 132, 252, 0.4)' : undefined }}
                        onClick={() => setCalibratingDepth(d)}
                        title={`Re-calibrate quadrat frame for all photos at depth ${d}m`}
                      >
                        📐 {hasDepthCal ? 'Edit Depth Calibration' : `Calibrate Depth ${d}m`}
                      </button>

                      {hasDepthCal && (
                        <button
                          type="button"
                          className="btn-text-reset"
                          onClick={() => resetDepthCalibration(d)}
                          title="Revert back to survey-wide calibration"
                        >
                          ↺ Revert to Global
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 5 Chosen Slots for this Depth */}
                  <div className="segment-grid">
                    {[0, 1, 2, 3, 4].map(slotIdx => {
                      const photoName = currentPicks[slotIdx];
                      const photoObj = allDepthList.find(p => p.filename === photoName);
                      const activeCorners = photoName ? getActiveCornersForPhoto(d, photoName) : pts;
                      const hasPhotoOverride = photoName && Boolean(customCrops[photoName]);

                      return (
                        <div key={slotIdx} className="segment-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                            <span>Slot #{slotIdx + 1}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{photoName ? 'Chosen' : 'Empty'}</span>
                          </div>

                          {photoObj ? (
                            <>
                              <div style={{ position: 'relative' }}>
                                <img
                                  src={`/api/image/warped?path=${encodeURIComponent(photoObj.path)}&corners_json=${encodeURIComponent(JSON.stringify(activeCorners))}&size=250&auto_detect=false`}
                                  alt={photoName}
                                  loading="lazy"
                                />
                                {hasPhotoOverride && (
                                  <div className="custom-crop-badge-overlay" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', bottom: '6px', left: '6px' }}>
                                    ⭐ Custom Crop
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={photoName}>
                                {photoName}
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    setSlideLoading(true);
                                    setLightbox({ depth: d, slotIdx });
                                  }}
                                >
                                  🔍 View & Slide
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                  title="Custom Re-Calibrate / Rotate for this photo only"
                                  onClick={() => setCalibratingPhoto(photoObj)}
                                >
                                  📐
                                </button>
                              </div>
                            </>
                          ) : (
                            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
                              No photo selected
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================================
            STEP 5: FINAL SELECT & EXPORT
            ========================================================================= */}
        {activeTab === 'export' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ color: 'var(--primary)' }}>Final Survey Export</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  Review selected photos across all depths and export standardized survey packages.
                </p>
              </div>

              <button
                className="btn btn-primary"
                style={{ padding: '0.8rem 2rem', fontSize: '1rem' }}
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Exporting...' : '📦 Export Final Survey'}
              </button>
            </div>

            {/* Export Summary Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              {selectedDepths.map(d => {
                const picks = selectedPhotos[d] || [];
                const allList = depthPhotos[d] || [];
                const hasDepthCal = Boolean(depthCrops[d]);

                return (
                  <div key={d} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
                        Depth {d} meters ({picks.length} photos)
                      </strong>
                      {hasDepthCal && (
                        <span className="badge-depth-cal">⭐ Depth Calibration Active</span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                      {picks.map((fn, idx) => {
                        const photoObj = allList.find(p => p.filename === fn);
                        const activeCorners = getActiveCornersForPhoto(d, fn);
                        const isCustom = Boolean(customCrops[fn]);

                        return (
                          <div key={fn} style={{ background: '#050811', borderRadius: 'var(--radius-sm)', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {photoObj && (
                              <img
                                src={`/api/image/warped?path=${encodeURIComponent(photoObj.path)}&corners_json=${encodeURIComponent(JSON.stringify(activeCorners))}&size=200`}
                                alt={fn}
                                style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            )}
                            <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginTop: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              #{idx + 1} {fn}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: isCustom ? 'var(--accent-emerald)' : 'var(--text-dim)', marginTop: '0.2rem' }}>
                              {isCustom ? '⭐ Photo Override' : hasDepthCal ? 'Depth Calibrated' : 'Survey Default'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Export Success Result Card */}
            {exportResult && (
              <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <h3 style={{ color: 'var(--accent-emerald)', marginBottom: '0.5rem' }}>
                  🎉 Survey Export Completed!
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Successfully processed and cropped <strong>{exportResult.count} photos</strong> to:
                </p>
                <div className="form-code" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                  {exportResult.export_base}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            MODAL 1: LIGHTBOX POPUP MODAL (Fixes issue #2)
            ========================================================================= */}
        {lightbox && (
          <div className="modal-backdrop" onClick={() => setLightbox(null)}>
            <div className="modal-content lightbox-modal" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const { depth, slotIdx } = lightbox;
                const currentPicks = selectedPhotos[depth] || [];
                const currentPhotoName = currentPicks[slotIdx];
                const allDepthList = depthPhotos[depth] || [];
                // Unused pool + current photo for this slot
                const candidatePool = allDepthList.filter(p => !currentPicks.includes(p.filename) || p.filename === currentPhotoName);
                const currentCandidateIdx = Math.max(0, candidatePool.findIndex(p => p.filename === currentPhotoName));
                const candidate = candidatePool[currentCandidateIdx] || allDepthList.find(p => p.filename === currentPhotoName);

                if (!candidate) return <div style={{ padding: '2rem' }}>Candidate photo not found</div>;

                const activeCorners = getActiveCornersForPhoto(depth, candidate.filename);
                const hasCustomCrop = Boolean(customCrops[candidate.filename]);
                const hasDepthCal = Boolean(depthCrops[depth]);

                return (
                  <>
                    {/* Lightbox Modal Header */}
                    <div className="lightbox-modal-header">
                      <div>
                        <h3 style={{ color: 'var(--primary)', fontSize: '1.15rem' }}>
                          🔍 Lightbox Review — Depth {depth}m, Slot #{slotIdx + 1}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Candidate {currentCandidateIdx + 1} of {candidatePool.length} in this depth pool
                        </p>
                      </div>

                      <button
                        type="button"
                        className="btn-icon-clear"
                        style={{ fontSize: '1.6rem', padding: '0.25rem 0.75rem' }}
                        onClick={() => setLightbox(null)}
                        title="Close Lightbox (Esc)"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Lightbox Modal Body: Split view with vertical candidate gallery */}
                    <div className="lightbox-modal-body">
                      {/* Left Column: Active Slot Preview & Slot Switcher */}
                      <div className="lightbox-preview-col">
                        {/* Slot Navigation Pills */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Switch Editing Slot (Depth {depth}m):
                          </span>
                          <div className="lightbox-slot-nav">
                            {[0, 1, 2, 3, 4].map(sIdx => (
                              <button
                                key={sIdx}
                                type="button"
                                className={`lightbox-slot-nav-btn ${slotIdx === sIdx ? 'active' : ''}`}
                                onClick={() => {
                                  setSlideLoading(true);
                                  setLightbox({ depth, slotIdx: sIdx });
                                }}
                              >
                                Slot #{sIdx + 1}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Large 1:1 Warped Preview */}
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
                            src={`/api/image/warped?path=${encodeURIComponent(candidate.path)}&corners_json=${encodeURIComponent(JSON.stringify(activeCorners))}&size=600&auto_detect=false`}
                            alt={candidate.filename}
                            onLoad={() => setSlideLoading(false)}
                          />

                          {hasCustomCrop && (
                            <div className="custom-crop-badge-overlay">
                              ⭐ Custom Photo Override Applied
                            </div>
                          )}
                          {!hasCustomCrop && hasDepthCal && (
                            <div className="custom-crop-badge-overlay" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}>
                              ⭐ Depth {depth}m Calibration Applied
                            </div>
                          )}
                        </div>

                        {/* Details and Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.7)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }} title={candidate.filename}>
                              Slot #{slotIdx + 1}: {candidate.filename}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                              {hasCustomCrop ? 'Custom crop applied' : hasDepthCal ? `Depth ${depth}m calibrated` : 'Survey default crop'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                              onClick={() => setCalibratingPhoto(candidate)}
                              title="Re-calibrate or rotate crop for this photo only"
                            >
                              📐 {hasCustomCrop ? 'Edit Crop' : 'Re-Calibrate / Rotate'}
                            </button>
                            {hasCustomCrop && (
                              <button
                                type="button"
                                className="btn-text-reset"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => {
                                  setCustomCrops(prev => {
                                    const next = { ...prev };
                                    delete next[candidate.filename];
                                    return next;
                                  });
                                  setSlideLoading(true);
                                }}
                              >
                                ↺ Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Vertical Candidate Gallery Grid */}
                      <div className="lightbox-gallery-col">
                        <div className="lightbox-gallery-header">
                          <div>
                            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                              Depth {depth}m Photos Gallery
                            </h4>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Click any photo below to select it for <strong>Slot #{slotIdx + 1}</strong> (scroll vertically):
                            </p>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {allDepthList.length} photos
                          </span>
                        </div>

                        {/* Vertical Scrolling Grid */}
                        <div className="lightbox-candidate-gallery">
                          {allDepthList.map((photo) => {
                            const isCurrentPick = photo.filename === currentPhotoName;
                            const otherSlotIdx = currentPicks.findIndex((fn, idx) => idx !== slotIdx && fn === photo.filename);
                            const isInOtherSlot = otherSlotIdx !== -1;

                            return (
                              <div
                                key={photo.filename}
                                className={`lightbox-candidate-card ${isCurrentPick ? 'active-slot-pick' : ''}`}
                                onClick={() => handleSwapSlotCandidate(depth, slotIdx, photo.filename)}
                                title={`Click to select ${photo.filename} for Slot #${slotIdx + 1}`}
                              >
                                <img
                                  src={`/api/image/raw?path=${encodeURIComponent(photo.path)}&w=220`}
                                  alt={photo.filename}
                                  className="lightbox-candidate-thumb"
                                  loading="lazy"
                                />
                                {isCurrentPick && (
                                  <div className="lightbox-pick-badge">
                                    ✓ Slot #{slotIdx + 1}
                                  </div>
                                )}
                                {!isCurrentPick && isInOtherSlot && (
                                  <div className="lightbox-pick-badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff' }}>
                                    In Slot #{otherSlotIdx + 1}
                                  </div>
                                )}
                                <div className="lightbox-candidate-name" title={photo.filename}>
                                  {photo.filename}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 2: CUSTOM DEPTH CALIBRATION (Fixes issue #3)
            ========================================================================= */}
        {calibratingDepth && (
          <div className="modal-backdrop">
            <div className="modal-content glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                    📐 Custom Quadrat Calibration — All Photos at Depth {calibratingDepth}m
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    This calibration will apply to <strong>every picture at depth {calibratingDepth}m</strong> (compensating for camera tilt while swimming to this depth).
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-icon-clear"
                  style={{ fontSize: '1.5rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setCalibratingDepth(null)}
                >
                  ✕
                </button>
              </div>

              {(() => {
                const list = depthPhotos[calibratingDepth] || [];
                const samplePhoto = list[0];
                if (!samplePhoto) return <p>No photos available for depth {calibratingDepth}m</p>;

                return (
                  <PhotoCropEditor
                    imageSrc={`/api/image/raw?path=${encodeURIComponent(samplePhoto.path)}`}
                    initialCorners={depthCrops[calibratingDepth] || pts}
                    saveButtonLabel={`💾 Save Calibration for Entire Depth ${calibratingDepth}m`}
                    onCancel={() => setCalibratingDepth(null)}
                    onSaveCalibration={({ corners }) => saveDepthCalibration(calibratingDepth, corners)}
                    onReset={() => resetDepthCalibration(calibratingDepth)}
                  />
                );
              })()}
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 3: SINGLE-PHOTO CUSTOM CALIBRATION MODAL
            ========================================================================= */}
        {calibratingPhoto && (
          <div className="modal-backdrop">
            <div className="modal-content glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>
                    📐 Custom Crop & Rotation — {calibratingPhoto.filename}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Adjust the 1:1 square crop or rotate for <strong>this specific picture only</strong> (e.g. wall current angle).
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
                initialCorners={customCrops[calibratingPhoto.filename] || (calibratingPhoto.depth ? depthCrops[calibratingPhoto.depth] : null) || pts}
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

        {/* =========================================================================
            MODAL 4: INGEST LOADING PROGRESS OVERLAY (Fixes issue #1)
            ========================================================================= */}
        {importing && (
          <div className="modal-backdrop">
            <div className="progress-card">
              <div className="spinner-ring" style={{ margin: '0 auto' }}></div>
              <h3 style={{ color: 'var(--primary)' }}>Ingesting Photos...</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Scanning source folder, organizing depths, and copying to reserved structure.
              </p>
              <div className="progress-metrics-row" style={{ justifyContent: 'center', gap: '1rem' }}>
                <span><span className="pulse-dot"></span>Time Elapsed: {importElapsed}s</span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 5: EXPORT LIVE PROGRESS MODAL WITH ETA (Fixes issue #1)
            ========================================================================= */}
        {exporting && exportProgress && (
          <div className="modal-backdrop">
            <div className="progress-card">
              <h3 style={{ color: 'var(--primary)' }}>Exporting Survey Photos</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Applying perspective correction crops and writing to final survey directories...
              </p>

              {/* Progress Track & Fill */}
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${exportProgress.total > 0 ? Math.min(100, Math.round((exportProgress.current / exportProgress.total) * 100)) : 0}%`
                  }}
                ></div>
              </div>

              {/* Progress Metrics & ETA */}
              <div className="progress-metrics-row">
                <span>
                  {exportProgress.current} / {exportProgress.total} photos
                  ({exportProgress.total > 0 ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0}%)
                </span>
                <span>
                  {(() => {
                    if (exportProgress.current > 0 && exportProgress.elapsed > 0) {
                      const secPerPhoto = exportProgress.elapsed / exportProgress.current;
                      const remaining = Math.max(0, Math.round((exportProgress.total - exportProgress.current) * secPerPhoto));
                      return `ETA: ~${remaining}s`;
                    }
                    return 'Calculating ETA...';
                  })()}
                </span>
              </div>

              {exportProgress.filename && (
                <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  Processing: {exportProgress.depth ? `[${exportProgress.depth}m] ` : ''}{exportProgress.filename}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
