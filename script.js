const field = document.getElementById('field');
const panel = document.getElementById('panel');
const panelHeader = document.getElementById('panelHeader');
const panelBody = document.getElementById('panelBody');
const togglePanel = document.getElementById('togglePanel');
const backgroundColorInput = document.getElementById('backgroundColor');
const pipeColorInput = document.getElementById('pipeColor');
const fpsEnabledInput = document.getElementById('fpsEnabled');
const fpsReadout = document.getElementById('fpsReadout');
const fpsValue = document.getElementById('fpsValue');

const spacingInput = document.getElementById('spacing');
const spacingValue = document.getElementById('spacingValue');
const radiusInput = document.getElementById('radius');
const radiusValue = document.getElementById('radiusValue');
const rotationModeInput = document.getElementById('rotationMode');
const smoothnessInput = document.getElementById('smoothness');
const smoothnessValue = document.getElementById('smoothnessValue');
const strengthInput = document.getElementById('strength');
const strengthValue = document.getElementById('strengthValue');
const symbolSizeInput = document.getElementById('symbolSize');
const symbolSizeValue = document.getElementById('symbolSizeValue');
const panelOpacityInput = document.getElementById('panelOpacity');
const panelOpacityValue = document.getElementById('panelOpacityValue');

const marks = [];
let activeMarkIndexes = [];
let gridCols = 0;
let gridRows = 0;
let frameToken = 0;
let fpsRafId = 0;
let fpsFrameCount = 0;
let fpsLastTime = 0;

const config = {
  backgroundColor: backgroundColorInput.value,
  pipeColor: pipeColorInput.value,
  showFps: fpsEnabledInput.checked,
  cellSize: Number(spacingInput.value),
  effectRadius: Number(radiusInput.value),
  rotationMode: rotationModeInput.value,
  smoothness: Number(smoothnessInput.value),
  strength: Number(strengthInput.value),
  symbolSize: Number(symbolSizeInput.value)
};

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let rafId = 0;

function normalizeLineAngle(angleDeg) {
  return ((((angleDeg + 90) % 180) + 180) % 180) - 90;
}

function stabilizeLineAngle(targetAngle, previousAngle) {
  let adjusted = targetAngle;

  while (adjusted - previousAngle > 90) {
    adjusted -= 180;
  }

  while (adjusted - previousAngle < -90) {
    adjusted += 180;
  }

  return adjusted;
}

function angleToPipeRotation(vectorX, vectorY) {
  return Math.atan2(vectorY, vectorX) * (180 / Math.PI) + 90;
}

function applyColors() {
  document.documentElement.style.setProperty('--bg-color', config.backgroundColor);
  document.documentElement.style.setProperty('--pipe-color', config.pipeColor);
}

function fpsLoop(timestamp) {
  if (!config.showFps) {
    fpsRafId = 0;
    return;
  }

  if (!fpsLastTime) {
    fpsLastTime = timestamp;
  }

  fpsFrameCount += 1;
  const elapsed = timestamp - fpsLastTime;

  if (elapsed >= 500) {
    const currentFps = Math.round((fpsFrameCount * 1000) / elapsed);
    fpsValue.textContent = String(currentFps);
    fpsFrameCount = 0;
    fpsLastTime = timestamp;
  }

  fpsRafId = requestAnimationFrame(fpsLoop);
}

function setFpsEnabled(enabled) {
  config.showFps = enabled;
  fpsReadout.hidden = !enabled;

  if (enabled) {
    fpsFrameCount = 0;
    fpsLastTime = 0;

    if (!fpsRafId) {
      fpsRafId = requestAnimationFrame(fpsLoop);
    }
  } else {
    fpsValue.textContent = '0';

    if (fpsRafId) {
      cancelAnimationFrame(fpsRafId);
      fpsRafId = 0;
    }
  }
}

function createGrid() {
  marks.length = 0;
  activeMarkIndexes = [];
  field.textContent = '';

  gridCols = Math.ceil(window.innerWidth / config.cellSize);
  gridRows = Math.ceil(window.innerHeight / config.cellSize);

  field.style.gridTemplateColumns = `repeat(${gridCols}, ${config.cellSize}px)`;
  field.style.gridTemplateRows = `repeat(${gridRows}, ${config.cellSize}px)`;

  const fragment = document.createDocumentFragment();

  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = '|';
      mark.style.width = `${config.cellSize}px`;
      mark.style.height = `${config.cellSize}px`;
      mark.style.fontSize = `${config.symbolSize}px`;

      const centerX = col * config.cellSize + config.cellSize / 2;
      const centerY = row * config.cellSize + config.cellSize / 2;

      marks.push({
        element: mark,
        x: centerX,
        y: centerY,
        token: 0,
        lastAngle: 0
      });

      fragment.appendChild(mark);
    }
  }

  field.appendChild(fragment);
  updateMarks();
}

function updateMarks() {
  if (!gridCols || !gridRows) {
    return;
  }

  frameToken += 1;
  const nextActiveIndexes = [];
  const radius = config.effectRadius;
  const radiusSquared = radius * radius;
  const cellReach = Math.ceil(radius / config.cellSize);
  const centerCol = Math.floor(mouseX / config.cellSize);
  const centerRow = Math.floor(mouseY / config.cellSize);
  const minCol = Math.max(0, centerCol - cellReach);
  const maxCol = Math.min(gridCols - 1, centerCol + cellReach);
  const minRow = Math.max(0, centerRow - cellReach);
  const maxRow = Math.min(gridRows - 1, centerRow + cellReach);
  const smoothnessFactor = config.smoothness / 100;
  const strength = config.strength;
  const isDirectMode = config.rotationMode === 'direct';
  const isMagneticMode = config.rotationMode === 'magnetic';

  for (let row = minRow; row <= maxRow; row += 1) {
    const rowStart = row * gridCols;

    for (let col = minCol; col <= maxCol; col += 1) {
      const index = rowStart + col;
      const mark = marks[index];
      const dx = mouseX - mark.x;
      const dy = mouseY - mark.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared > radiusSquared) {
        continue;
      }

      const distance = Math.sqrt(distanceSquared);
      const angleTowardCursor = angleToPipeRotation(dx, dy);
      const normalizedTargetAngle = normalizeLineAngle(angleTowardCursor);

      const normalizedDistance = distance / radius;
      const directCurve = Math.pow(1 - normalizedDistance, 2);
      const softCurve = Math.pow(1 - normalizedDistance, 1.5);
      const selectedCurve = isDirectMode || isMagneticMode ? directCurve : softCurve;
      const distanceInfluence = (1 - smoothnessFactor) + smoothnessFactor * selectedCurve;
      const finalInfluence = strength * Math.max(distanceInfluence, 0);

      if (isDirectMode) {
        const directAngle = normalizedTargetAngle * finalInfluence;
        const stableAngle = stabilizeLineAngle(directAngle, mark.lastAngle);
        mark.element.style.transform = `rotate(${stableAngle}deg)`;
        mark.lastAngle = stableAngle;
      } else if (isMagneticMode) {
        const tangentX = -dy;
        const tangentY = dx;
        const radialMix = 0.28;
        const magneticVectorX = tangentX + dx * radialMix;
        const magneticVectorY = tangentY + dy * radialMix;
        const magneticAngle = angleToPipeRotation(magneticVectorX, magneticVectorY);
        const normalizedMagneticAngle = normalizeLineAngle(magneticAngle);
        const weightedMagneticAngle = normalizedMagneticAngle * finalInfluence;
        const stableAngle = stabilizeLineAngle(weightedMagneticAngle, mark.lastAngle);
        mark.element.style.transform = `rotate(${stableAngle}deg)`;
        mark.lastAngle = stableAngle;
      } else {
        const weightedAngle = angleTowardCursor * finalInfluence;
        const stableAngle = stabilizeLineAngle(weightedAngle, mark.lastAngle);
        mark.element.style.transform = `rotate(${stableAngle}deg)`;
        mark.lastAngle = stableAngle;
      }

      mark.token = frameToken;
      nextActiveIndexes.push(index);
    }
  }

  for (let i = 0; i < activeMarkIndexes.length; i += 1) {
    const index = activeMarkIndexes[i];
    const mark = marks[index];

    if (mark && mark.token !== frameToken) {
      mark.element.style.transform = 'rotate(0deg)';
      mark.lastAngle = 0;
    }
  }

  activeMarkIndexes = nextActiveIndexes;
}

function syncPanelValues() {
  spacingValue.textContent = String(config.cellSize);
  radiusValue.textContent = String(config.effectRadius);
  smoothnessValue.textContent = config.smoothness.toFixed(1);
  strengthValue.textContent = config.strength.toFixed(2);
  symbolSizeValue.textContent = String(config.symbolSize);
  panelOpacityValue.textContent = Number(panelOpacityInput.value).toFixed(2);
}

function updateRadiusBounds() {
  const diagonal = Math.ceil(Math.hypot(window.innerWidth, window.innerHeight));
  const maxRadius = Math.max(diagonal, 200);
  radiusInput.max = String(maxRadius);

  if (config.effectRadius > maxRadius) {
    config.effectRadius = maxRadius;
    radiusInput.value = String(maxRadius);
  }
}

function bindControls() {
  backgroundColorInput.addEventListener('input', () => {
    config.backgroundColor = backgroundColorInput.value;
    applyColors();
  });

  pipeColorInput.addEventListener('input', () => {
    config.pipeColor = pipeColorInput.value;
    applyColors();
  });

  spacingInput.addEventListener('input', () => {
    config.cellSize = Number(spacingInput.value);
    syncPanelValues();
    createGrid();
  });

  radiusInput.addEventListener('input', () => {
    config.effectRadius = Number(radiusInput.value);
    syncPanelValues();
    updateMarks();
  });

  smoothnessInput.addEventListener('input', () => {
    config.smoothness = Number(smoothnessInput.value);
    syncPanelValues();
    updateMarks();
  });

  rotationModeInput.addEventListener('change', () => {
    config.rotationMode = rotationModeInput.value;
    updateMarks();
  });

  strengthInput.addEventListener('input', () => {
    config.strength = Number(strengthInput.value);
    syncPanelValues();
    updateMarks();
  });

  symbolSizeInput.addEventListener('input', () => {
    config.symbolSize = Number(symbolSizeInput.value);
    syncPanelValues();
    createGrid();
  });

  panelOpacityInput.addEventListener('input', () => {
    panel.style.opacity = panelOpacityInput.value;
    syncPanelValues();
  });

  fpsEnabledInput.addEventListener('change', () => {
    setFpsEnabled(fpsEnabledInput.checked);
  });
}

function bindCollapse() {
  togglePanel.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    togglePanel.textContent = collapsed ? '+' : '−';
    togglePanel.setAttribute('aria-expanded', String(!collapsed));
    panelBody.setAttribute('aria-hidden', String(collapsed));
  });
}

function bindDrag() {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  panelHeader.addEventListener('pointerdown', (event) => {
    if (event.target === togglePanel) {
      return;
    }

    dragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    panelHeader.setPointerCapture(event.pointerId);
  });

  panelHeader.addEventListener('pointermove', (event) => {
    if (!dragging) {
      return;
    }

    const maxLeft = window.innerWidth - panel.offsetWidth;
    const maxTop = window.innerHeight - panel.offsetHeight;
    const nextLeft = Math.min(Math.max(event.clientX - offsetX, 0), maxLeft);
    const nextTop = Math.min(Math.max(event.clientY - offsetY, 0), maxTop);

    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  });

  panelHeader.addEventListener('pointerup', (event) => {
    dragging = false;
    panelHeader.releasePointerCapture(event.pointerId);
  });
}

window.addEventListener('mousemove', (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;

  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      updateMarks();
      rafId = 0;
    });
  }
});

window.addEventListener('resize', () => {
  updateRadiusBounds();
  createGrid();
});

bindControls();
bindCollapse();
bindDrag();
applyColors();
panel.style.opacity = panelOpacityInput.value;
setFpsEnabled(config.showFps);
updateRadiusBounds();
syncPanelValues();
createGrid();
