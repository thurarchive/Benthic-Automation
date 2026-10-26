import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Windows Photos-style 1:1 Square Crop Editor.
 * Features:
 * - Strictly locked 1:1 square ratio for benthic quadrat calibration.
 * - 4 Corner bracket handles (L-shaped) + 4 edge pill handles.
 * - Interactive retraction & expansion (drag handles to resize).
 * - Drag interior to reposition / pan.
 * - Keyboard arrow keys for precision nudging (1px, or 10px with Shift).
 * - Bottom angle rotation ruler (-45° to +45°) with degree readout and ticks.
 * - 90° CCW / CW rotation buttons and flip controls.
 * - Dimmed outer scrim mask.
 * - Live unwarped 1:1 square preview.
 * - Export of exact 4-corner coordinates in full-resolution image space.
 */
export default function PhotoCropEditor({
  imageSrc,
  initialCorners,
  onSaveCalibration,
  onReset,
  onCancel,
  title,
  saveButtonLabel = '💾 Save Calibration',
}) {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);

  // Loaded full-resolution image object
  const [imageObj, setImageObj] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Zoom & Viewport scale
  const [zoom, setZoom] = useState(1.0);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });

  // 1:1 Square Crop Box state (in original image coordinates)
  // { cx: number, cy: number, side: number, angle: number (degrees), flipH: boolean, flipV: boolean }
  const [cropBox, setCropBox] = useState({
    cx: 0,
    cy: 0,
    side: 600,
    angle: 0,
    flipH: false,
    flipV: false,
  });

  // Drag interaction state
  // dragMode: 'none' | 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  const [dragMode, setDragMode] = useState('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialBox: null });
  const [hoverHandle, setHoverHandle] = useState('none');
  const [isActivelyEditing, setIsActivelyEditing] = useState(false);

  // Load image
  useEffect(() => {
    if (!imageSrc) return;
    setImgLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      setImageObj(img);
      setImgLoaded(true);

      const natW = img.naturalWidth || img.width;
      const natH = img.naturalHeight || img.height;

      // If initial corners are provided, derive center, side, and angle
      if (initialCorners && initialCorners.length === 4) {
        const pts = initialCorners;
        const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
        const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
        const topEdge = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
        const rightEdge = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
        const avgSide = (topEdge + rightEdge) / 2;
        const initialAngle = (Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) * 180) / Math.PI;

        setCropBox({
          cx: Math.round(cx),
          cy: Math.round(cy),
          side: Math.max(100, Math.round(avgSide)),
          angle: Math.round(initialAngle * 10) / 10,
          flipH: false,
          flipV: false,
        });
      } else {
        // Default: square box centered, side = 65% of smaller dimension
        const defSide = Math.round(Math.min(natW, natH) * 0.65);
        setCropBox({
          cx: Math.round(natW / 2),
          cy: Math.round(natH / 2),
          side: defSide,
          angle: 0,
          flipH: false,
          flipV: false,
        });
      }
    };
  }, [imageSrc, initialCorners]);

  // Adjust canvas size to match container width while maintaining nice aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerW = containerRef.current.clientWidth || 900;
        const targetW = Math.min(containerW, 1100);
        const targetH = Math.min(Math.round(targetW * 0.62), 650);
        setCanvasSize({ width: targetW, height: targetH });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Compute display scale to fit natural image inside canvas viewport
  const getDisplayMetrics = useCallback(() => {
    if (!imageObj) return { scale: 1, offsetX: 0, offsetY: 0 };
    const natW = imageObj.naturalWidth || imageObj.width;
    const natH = imageObj.naturalHeight || imageObj.height;

    // Base fit scale
    const baseScale = Math.min(
      (canvasSize.width - 40) / natW,
      (canvasSize.height - 40) / natH
    );
    const scale = baseScale * zoom;
    const renderW = natW * scale;
    const renderH = natH * scale;
    const offsetX = (canvasSize.width - renderW) / 2;
    const offsetY = (canvasSize.height - renderH) / 2;

    return { scale, offsetX, offsetY, natW, natH, renderW, renderH };
  }, [imageObj, canvasSize, zoom]);

  // Calculate 4 corners in original image resolution: [TL, TR, BR, BL]
  const getCornersInImageSpace = useCallback(() => {
    const { cx, cy, side, angle } = cropBox;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const half = side / 2;

    // Offsets for 1:1 square: TL, TR, BR, BL
    const offsets = [
      [-half, -half], // TL
      [+half, -half], // TR
      [+half, +half], // BR
      [-half, +half], // BL
    ];

    return offsets.map(([ox, oy]) => [
      Math.round((cx + ox * cos - oy * sin) * 10) / 10,
      Math.round((cy + ox * sin + oy * cos) * 10) / 10,
    ]);
  }, [cropBox]);

  // Check which handle or region mouse is hovering
  const getHitHandle = useCallback((mouseX, mouseY) => {
    if (!imageObj) return 'none';
    const { cx, cy, side, angle } = cropBox;
    const { scale, offsetX, offsetY } = getDisplayMetrics();

    // Center in screen coordinates
    const scx = offsetX + cx * scale;
    const scy = offsetY + cy * scale;
    const sSide = side * scale;
    const sHalf = sSide / 2;

    // Rotate mouse point into box's local coordinate system
    const rad = (-angle * Math.PI) / 180;
    const dx = mouseX - scx;
    const dy = mouseY - scy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

    const hitRadius = 20; // generous click area for touch & mouse

    // Check 4 Corner brackets
    if (Math.hypot(lx - (-sHalf), ly - (-sHalf)) <= hitRadius) return 'nw';
    if (Math.hypot(lx - (+sHalf), ly - (-sHalf)) <= hitRadius) return 'ne';
    if (Math.hypot(lx - (+sHalf), ly - (+sHalf)) <= hitRadius) return 'se';
    if (Math.hypot(lx - (-sHalf), ly - (+sHalf)) <= hitRadius) return 'sw';

    // Check 4 Edge centers
    if (Math.hypot(lx, ly - (-sHalf)) <= hitRadius) return 'n';
    if (Math.hypot(lx - (+sHalf), ly) <= hitRadius) return 'e';
    if (Math.hypot(lx, ly - (+sHalf)) <= hitRadius) return 's';
    if (Math.hypot(lx - (-sHalf), ly) <= hitRadius) return 'w';

    // Check interior
    if (Math.abs(lx) <= sHalf && Math.abs(ly) <= sHalf) return 'move';

    return 'none';
  }, [imageObj, cropBox, getDisplayMetrics]);

  // Draw Canvas
  useEffect(() => {
    if (!canvasRef.current || !imageObj || !imgLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;

    // 1. Clear dark canvas background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    const { scale, offsetX, offsetY, renderW, renderH } = getDisplayMetrics();

    // 2. Draw raw calibration image
    ctx.save();
    ctx.drawImage(imageObj, offsetX, offsetY, renderW, renderH);
    ctx.restore();

    // 3. Draw outer dimmed scrim mask around the 1:1 square
    const { cx, cy, side, angle } = cropBox;
    const scx = offsetX + cx * scale;
    const scy = offsetY + cy * scale;
    const sSide = side * scale;
    const sHalf = sSide / 2;

    ctx.save();
    // Use evenodd path to cut the 1:1 rotated square out of the full dark scrim overlay
    ctx.beginPath();
    ctx.rect(0, 0, width, height);

    ctx.translate(scx, scy);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.rect(-sHalf, -sHalf, sSide, sSide);

    ctx.fillStyle = 'rgba(7, 12, 24, 0.72)'; // Windows Photos dark translucent mask
    ctx.fill('evenodd');
    ctx.restore();

    // 4. Draw Crop Box outline and Rule-of-Thirds Grid
    ctx.save();
    ctx.translate(scx, scy);
    ctx.rotate((angle * Math.PI) / 180);

    // Thin white border around square
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sHalf, -sHalf, sSide, sSide);

    // Subtle 3x3 alignment grid while editing/dragging
    if (isActivelyEditing || dragMode !== 'none') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Vertical 1/3 and 2/3 lines
      const third = sSide / 3;
      ctx.beginPath();
      ctx.moveTo(-sHalf + third, -sHalf);
      ctx.lineTo(-sHalf + third, +sHalf);
      ctx.moveTo(-sHalf + third * 2, -sHalf);
      ctx.lineTo(-sHalf + third * 2, +sHalf);

      // Horizontal 1/3 and 2/3 lines
      ctx.moveTo(-sHalf, -sHalf + third);
      ctx.lineTo(+sHalf, -sHalf + third);
      ctx.moveTo(-sHalf, -sHalf + third * 2);
      ctx.lineTo(+sHalf, -sHalf + third * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw Windows Photos-style L-shaped Corner Bracket Handles
    const bracketLen = Math.min(26, sSide * 0.22);
    const bracketThick = 4.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = bracketThick;
    ctx.lineCap = 'square';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;

    const drawBracket = (bx, by, dirX, dirY) => {
      ctx.beginPath();
      ctx.moveTo(bx + dirX * bracketLen, by);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx, by + dirY * bracketLen);
      ctx.stroke();
    };

    // NW Bracket
    drawBracket(-sHalf, -sHalf, 1, 1);
    // NE Bracket
    drawBracket(+sHalf, -sHalf, -1, 1);
    // SE Bracket
    drawBracket(+sHalf, +sHalf, -1, -1);
    // SW Bracket
    drawBracket(-sHalf, +sHalf, 1, -1);

    // 6. Draw 4 Edge Pill Handles (N, E, S, W)
    const pillLen = Math.min(24, sSide * 0.18);
    ctx.lineWidth = bracketThick;

    // N Edge
    ctx.beginPath();
    ctx.moveTo(-pillLen / 2, -sHalf);
    ctx.lineTo(pillLen / 2, -sHalf);
    ctx.stroke();

    // S Edge
    ctx.beginPath();
    ctx.moveTo(-pillLen / 2, +sHalf);
    ctx.lineTo(pillLen / 2, +sHalf);
    ctx.stroke();

    // E Edge
    ctx.beginPath();
    ctx.moveTo(+sHalf, -pillLen / 2);
    ctx.lineTo(+sHalf, pillLen / 2);
    ctx.stroke();

    // W Edge
    ctx.beginPath();
    ctx.moveTo(-sHalf, -pillLen / 2);
    ctx.lineTo(-sHalf, pillLen / 2);
    ctx.stroke();

    // 7. Center target dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00f2fe';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  }, [imageObj, imgLoaded, canvasSize, cropBox, zoom, isActivelyEditing, dragMode, getDisplayMetrics]);

  // Update Live Rectified Quadrat Preview Canvas
  useEffect(() => {
    if (!previewCanvasRef.current || !imageObj || !imgLoaded) return;
    const preview = previewCanvasRef.current;
    const ctx = preview.getContext('2d');
    const pSize = 220;
    preview.width = pSize;
    preview.height = pSize;

    ctx.clearRect(0, 0, pSize, pSize);

    // Render rotated 1:1 square crop directly
    const { cx, cy, side, angle } = cropBox;
    ctx.save();
    ctx.translate(pSize / 2, pSize / 2);
    const scaleFactor = pSize / side;
    ctx.scale(scaleFactor, scaleFactor);
    ctx.rotate((-angle * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    ctx.drawImage(imageObj, 0, 0);
    ctx.restore();

    // Outline
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, pSize, pSize);
  }, [imageObj, imgLoaded, cropBox]);

  // Mouse Down
  const handleMouseDown = (e) => {
    if (!canvasRef.current || !imageObj) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = getHitHandle(mx, my);
    if (hit !== 'none') {
      setDragMode(hit);
      setDragStart({ x: mx, y: my, initialBox: { ...cropBox } });
      setIsActivelyEditing(true);
    }
  };

  // Mouse Move
  const handleMouseMove = (e) => {
    if (!canvasRef.current || !imageObj) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragMode === 'none') {
      const hit = getHitHandle(mx, my);
      setHoverHandle(hit);
      return;
    }

    const { scale } = getDisplayMetrics();
    const { initialBox, x: startX, y: startY } = dragStart;
    const dxScreen = mx - startX;
    const dyScreen = my - startY;

    // Moving whole box
    if (dragMode === 'move') {
      const natW = imageObj.naturalWidth || imageObj.width;
      const natH = imageObj.naturalHeight || imageObj.height;
      const newCx = Math.max(
        initialBox.side / 2,
        Math.min(natW - initialBox.side / 2, initialBox.cx + dxScreen / scale)
      );
      const newCy = Math.max(
        initialBox.side / 2,
        Math.min(natH - initialBox.side / 2, initialBox.cy + dyScreen / scale)
      );
      setCropBox((prev) => ({
        ...prev,
        cx: Math.round(newCx),
        cy: Math.round(newCy),
      }));
      return;
    }

    // Resizing handles (strictly 1:1 square)
    const rad = (-initialBox.angle * Math.PI) / 180;
    const localDx = (dxScreen * Math.cos(rad) - dyScreen * Math.sin(rad)) / scale;
    const localDy = (dxScreen * Math.sin(rad) + dyScreen * Math.cos(rad)) / scale;

    let deltaSide = 0;
    if (dragMode === 'se') {
      deltaSide = localDx + localDy;
    } else if (dragMode === 'nw') {
      deltaSide = -(localDx + localDy);
    } else if (dragMode === 'ne') {
      deltaSide = localDx - localDy;
    } else if (dragMode === 'sw') {
      deltaSide = -localDx + localDy;
    } else if (dragMode === 'e' || dragMode === 'w') {
      deltaSide = (dragMode === 'e' ? localDx : -localDx) * 2;
    } else if (dragMode === 's' || dragMode === 'n') {
      deltaSide = (dragMode === 's' ? localDy : -localDy) * 2;
    }

    const minSide = 80;
    const maxSide = Math.min(imageObj.naturalWidth, imageObj.naturalHeight);
    const newSide = Math.min(maxSide, Math.max(minSide, initialBox.side + deltaSide));

    setCropBox((prev) => ({
      ...prev,
      side: Math.round(newSide),
    }));
  };

  // Mouse Up
  const handleMouseUp = () => {
    setDragMode('none');
    setIsActivelyEditing(false);
  };

  // Keyboard navigation & Precision nudging
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      const step = e.shiftKey ? 10 : 1;
      let handled = false;

      if (e.key === 'ArrowLeft') {
        setCropBox((prev) => ({ ...prev, cx: prev.cx - step }));
        handled = true;
      } else if (e.key === 'ArrowRight') {
        setCropBox((prev) => ({ ...prev, cx: prev.cx + step }));
        handled = true;
      } else if (e.key === 'ArrowUp') {
        setCropBox((prev) => ({ ...prev, cy: prev.cy - step }));
        handled = true;
      } else if (e.key === 'ArrowDown') {
        setCropBox((prev) => ({ ...prev, cy: prev.cy + step }));
        handled = true;
      } else if (e.key === '+' || e.key === '=') {
        setCropBox((prev) => ({ ...prev, side: prev.side + step * 2 }));
        handled = true;
      } else if (e.key === '-' || e.key === '_') {
        setCropBox((prev) => ({ ...prev, side: Math.max(80, prev.side - step * 2) }));
        handled = true;
      } else if (e.key === '[' || e.key === '{') {
        setCropBox((prev) => ({ ...prev, angle: Math.round((prev.angle - (e.shiftKey ? 5 : 0.5)) * 10) / 10 }));
        handled = true;
      } else if (e.key === ']' || e.key === '}') {
        setCropBox((prev) => ({ ...prev, angle: Math.round((prev.angle + (e.shiftKey ? 5 : 0.5)) * 10) / 10 }));
        handled = true;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 90 deg rotation
  const handleRotate90 = (direction) => {
    setCropBox((prev) => {
      let newAngle = prev.angle + (direction === 'cw' ? 90 : -90);
      if (newAngle > 180) newAngle -= 360;
      if (newAngle < -180) newAngle += 360;
      return { ...prev, angle: newAngle };
    });
  };

  // Reset
  const handleReset = () => {
    if (!imageObj) return;
    const natW = imageObj.naturalWidth || imageObj.width;
    const natH = imageObj.naturalHeight || imageObj.height;
    setCropBox({
      cx: Math.round(natW / 2),
      cy: Math.round(natH / 2),
      side: Math.round(Math.min(natW, natH) * 0.65),
      angle: 0,
      flipH: false,
      flipV: false,
    });
    setZoom(1.0);
    if (onReset) onReset();
  };

  // Save Calibration
  const handleSave = () => {
    const corners = getCornersInImageSpace();
    if (onSaveCalibration) {
      onSaveCalibration({
        corners,
        cropBox,
      });
    }
  };

  const getCursorStyle = () => {
    if (dragMode === 'move' || hoverHandle === 'move') return 'move';
    if (dragMode === 'nw' || dragMode === 'se' || hoverHandle === 'nw' || hoverHandle === 'se')
      return 'nwse-resize';
    if (dragMode === 'ne' || dragMode === 'sw' || hoverHandle === 'ne' || hoverHandle === 'sw')
      return 'nesw-resize';
    if (dragMode === 'n' || dragMode === 's' || hoverHandle === 'n' || hoverHandle === 's')
      return 'ns-resize';
    if (dragMode === 'e' || dragMode === 'w' || hoverHandle === 'e' || hoverHandle === 'w')
      return 'ew-resize';
    return 'default';
  };

  return (
    <div className="photo-crop-editor" ref={containerRef}>
      {/* Top Windows Photos Toolbar */}
      <div className="editor-top-toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className="tool-btn"
            title="Zoom Out"
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))}
          >
            🔍−
          </button>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="tool-btn"
            title="Zoom In"
            onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}
          >
            🔍+
          </button>
          <button
            type="button"
            className="tool-btn"
            title="Fit to Window"
            onClick={() => setZoom(1.0)}
          >
            Fit
          </button>
          <button
            type="button"
            className="tool-btn"
            title="Reset to default square"
            onClick={handleReset}
          >
            ↺ Reset
          </button>
        </div>

        <div className="toolbar-group">
          {title && <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)', marginRight: '0.5rem' }}>{title}</span>}
          <div className="aspect-badge">
            <span className="aspect-icon">⏹</span>
            <span>1:1 Square (Locked)</span>
          </div>
        </div>

        <div className="toolbar-group">
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              ✕ Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary save-cal-btn"
            onClick={handleSave}
          >
            {saveButtonLabel}
          </button>
        </div>
      </div>


      {/* Main Viewport & Preview Side-by-Side */}
      <div className="editor-viewport-container">
        {/* Main Canvas Viewport */}
        <div
          className="canvas-interactive-area"
          style={{ cursor: getCursorStyle() }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} />
          {!imgLoaded && (
            <div className="canvas-loading-spinner">Loading calibration photo...</div>
          )}
        </div>

        {/* Live Rectified Preview & Info Panel */}
        <div className="editor-side-panel">
          <div className="preview-card">
            <h4>Live Quadrat Crop Preview</h4>
            <p className="preview-desc">Perspective-rectified 1:1 square</p>
            <div className="preview-canvas-wrapper">
              <canvas ref={previewCanvasRef} />
            </div>
          </div>

          <div className="metrics-card">
            <h4>Crop Geometry</h4>
            <div className="metric-row">
              <span>Resolution:</span>
              <strong>{cropBox.side} × {cropBox.side} px</strong>
            </div>
            <div className="metric-row">
              <span>Center:</span>
              <strong>({cropBox.cx}, {cropBox.cy})</strong>
            </div>
            <div className="metric-row">
              <span>Rotation:</span>
              <strong>{cropBox.angle > 0 ? `+${cropBox.angle}°` : `${cropBox.angle}°`}</strong>
            </div>
            <div className="metric-row">
              <span>Aspect Ratio:</span>
              <strong style={{ color: 'var(--accent-emerald)' }}>1:1 (Square)</strong>
            </div>
          </div>

          <div className="editor-shortcuts-tip">
            <h5>⚡ Precision Keys</h5>
            <ul>
              <li><span className="kbd">↑</span> <span className="kbd">↓</span> <span className="kbd">←</span> <span className="kbd">→</span> Nudge box 1px</li>
              <li><span className="kbd">Shift</span> + <span className="kbd">Arrows</span> Nudge box 10px</li>
              <li><span className="kbd">+</span> / <span className="kbd">−</span> Expand / retract box</li>
              <li><span className="kbd">[</span> / <span className="kbd">]</span> Rotate ±0.5°</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Angle Rotation Ruler / Dial (Windows Photos style) */}
      <div className="editor-bottom-bar">
        <div className="rotation-control-block">
          <button
            type="button"
            className="btn-round-action"
            title="Rotate 90° CCW"
            onClick={() => handleRotate90('ccw')}
          >
            ↺ 90°
          </button>

          {/* Angle Dial & Ruler */}
          <div className="angle-ruler-wrapper">
            <div className="angle-display">
              <span className="angle-value">
                {cropBox.angle > 0 ? `+${cropBox.angle}°` : `${cropBox.angle}°`}
              </span>
              <button
                type="button"
                className="btn-text-reset"
                title="Reset angle to 0°"
                onClick={() => setCropBox((p) => ({ ...p, angle: 0 }))}
              >
                Reset 0°
              </button>
            </div>

            {/* Slider with degree ruler */}
            <div className="ruler-slider-container">
              <input
                type="range"
                className="angle-range-slider"
                min="-45"
                max="45"
                step="0.5"
                value={Math.max(-45, Math.min(45, cropBox.angle))}
                onChange={(e) =>
                  setCropBox((prev) => ({
                    ...prev,
                    angle: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="ruler-ticks">
                {[-45, -30, -15, 0, 15, 30, 45].map((tick) => (
                  <span
                    key={tick}
                    className={`tick-mark ${tick === 0 ? 'center' : ''}`}
                    onClick={() => setCropBox((p) => ({ ...p, angle: tick }))}
                  >
                    {tick}°
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-round-action"
            title="Rotate 90° CW"
            onClick={() => handleRotate90('cw')}
          >
            ↻ 90°
          </button>
        </div>
      </div>
    </div>
  );
}
