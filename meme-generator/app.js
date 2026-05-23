const MAX_DISPLAY_WIDTH = 800;
const FONT_FAMILY = "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
const DEFAULT_FONT_SIZE = 48;
const DEFAULT_TEXT = "Your text here";
const DEFAULT_TEXT_COLOR = "#ffffff";

const canvas = document.getElementById("meme-canvas");
const ctx = canvas.getContext("2d");
const canvasWrapper = document.getElementById("canvas-wrapper");
const canvasPlaceholder = document.getElementById("canvas-placeholder");
const fileUpload = document.getElementById("file-upload");
const templateGrid = document.getElementById("template-grid");
const addTextBtn = document.getElementById("add-text-btn");
const textControls = document.getElementById("text-controls");
const textInput = document.getElementById("text-input");
const fontSizeSlider = document.getElementById("font-size-slider");
const fontSizeValue = document.getElementById("font-size-value");
const textColorInput = document.getElementById("text-color-input");
const deleteTextBtn = document.getElementById("delete-text-btn");
const downloadBtn = document.getElementById("download-btn");
const layerList = document.getElementById("layer-list");
const colorHex = document.getElementById("color-hex");
const stageHint = document.getElementById("stage-hint");
const textEmpty = document.getElementById("text-empty");

let currentImage = null;
let textBoxes = [];
let selectedId = null;
let nextId = 1;
let displayScale = 1;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let activeTemplateBtn = null;

function getSelectedTextBox() {
  return textBoxes.find((box) => box.id === selectedId) ?? null;
}

function setControlsEnabled(hasImage) {
  addTextBtn.disabled = !hasImage;
  downloadBtn.disabled = !hasImage;
  canvasPlaceholder.classList.toggle("hidden", hasImage);
  canvas.style.display = hasImage ? "block" : "none";
  stageHint.classList.toggle("visible", hasImage);
}

function syncLayerList() {
  const hasLayers = textBoxes.length > 0;
  layerList.hidden = !hasLayers;
  textEmpty.classList.toggle("hidden", hasLayers);

  layerList.innerHTML = "";
  textBoxes.forEach((box, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `layer-item${box.id === selectedId ? " active" : ""}`;
    item.dataset.id = String(box.id);
    item.innerHTML = `
      <span class="layer-item-index">${index + 1}</span>
      <span class="layer-item-text">${box.text || "Empty text"}</span>
    `;
    item.addEventListener("click", () => selectTextBox(box.id));
    layerList.appendChild(item);
  });
}

function syncTextControls() {
  const selected = getSelectedTextBox();
  syncLayerList();

  if (!selected) {
    textControls.hidden = true;
    return;
  }

  textControls.hidden = false;
  textInput.value = selected.text;
  fontSizeSlider.value = String(selected.fontSize);
  fontSizeValue.textContent = String(selected.fontSize);
  textColorInput.value = selected.color;
  colorHex.textContent = selected.color.toUpperCase();
}

function setActiveTemplate(btn) {
  if (activeTemplateBtn) {
    activeTemplateBtn.classList.remove("active");
  }
  activeTemplateBtn = btn;
  if (btn) {
    btn.classList.add("active");
  }
}

function loadImageFromSource(src, onLoaded) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    currentImage = img;
    textBoxes = [];
    selectedId = null;
    syncTextControls();
    resizeCanvas();
    setControlsEnabled(true);
    if (onLoaded) {
      onLoaded();
    }
  };
  img.onerror = () => {
    alert("Could not load that image. Try another file or template.");
  };
  img.src = src;
}

function resizeCanvas() {
  if (!currentImage) {
    return;
  }

  displayScale = Math.min(1, MAX_DISPLAY_WIDTH / currentImage.width);
  canvas.width = Math.round(currentImage.width * displayScale);
  canvas.height = Math.round(currentImage.height * displayScale);
  redraw();
}

function wrapTextLines(targetCtx, text, maxWidth, fontSize) {
  targetCtx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const testLine = `${currentLine} ${words[i]}`;
    if (targetCtx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }

  lines.push(currentLine);
  return lines;
}

function getTextMetrics(targetCtx, text, fontSize, maxWidth) {
  const lines = wrapTextLines(targetCtx, text, maxWidth, fontSize);
  const lineHeight = fontSize * 1.15;
  const width = Math.max(...lines.map((line) => targetCtx.measureText(line).width), 0);
  const height = lines.length * lineHeight;
  return { lines, lineHeight, width, height };
}

function drawTextBox(targetCtx, box, scale, isSelected) {
  const fontSize = box.fontSize * scale;
  const x = box.x * scale;
  const y = box.y * scale;
  const maxWidth = (currentImage.width * 0.8) * scale;

  targetCtx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "middle";
  targetCtx.lineJoin = "round";
  targetCtx.miterLimit = 2;
  targetCtx.lineWidth = Math.max(2, fontSize / 12);
  targetCtx.strokeStyle = "black";
  targetCtx.fillStyle = box.color;

  const { lines, lineHeight, width, height } = getTextMetrics(targetCtx, box.text, fontSize, maxWidth);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    targetCtx.strokeText(line, x, lineY);
    targetCtx.fillText(line, x, lineY);
  });

  if (isSelected) {
    const padding = 8 * scale;
    targetCtx.save();
    targetCtx.strokeStyle = "rgba(249, 115, 22, 0.95)";
    targetCtx.lineWidth = 2 * scale;
    targetCtx.setLineDash([6 * scale, 4 * scale]);
    targetCtx.strokeRect(
      x - width / 2 - padding,
      y - height / 2 - padding,
      width + padding * 2,
      height + padding * 2
    );
    targetCtx.restore();
  }

  return { width, height };
}

function redraw() {
  if (!currentImage) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

  textBoxes.forEach((box) => {
    drawTextBox(ctx, box, displayScale, box.id === selectedId);
  });
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function toImageCoords(canvasX, canvasY) {
  return {
    x: canvasX / displayScale,
    y: canvasY / displayScale,
  };
}

function hitTestTextBox(canvasX, canvasY) {
  for (let i = textBoxes.length - 1; i >= 0; i -= 1) {
    const box = textBoxes[i];
    const fontSize = box.fontSize * displayScale;
    const x = box.x * displayScale;
    const y = box.y * displayScale;
    const maxWidth = (currentImage.width * 0.8) * displayScale;
    const { width, height } = getTextMetrics(ctx, box.text, fontSize, maxWidth);
    const padding = 10 * displayScale;

    if (
      canvasX >= x - width / 2 - padding &&
      canvasX <= x + width / 2 + padding &&
      canvasY >= y - height / 2 - padding &&
      canvasY <= y + height / 2 + padding
    ) {
      return box;
    }
  }
  return null;
}

function selectTextBox(id) {
  selectedId = id;
  syncTextControls();
  redraw();
}

function addTextBox() {
  if (!currentImage) {
    return;
  }

  const box = {
    id: nextId,
    text: DEFAULT_TEXT,
    x: currentImage.width / 2,
    y: currentImage.height / 2,
    fontSize: DEFAULT_FONT_SIZE,
    color: DEFAULT_TEXT_COLOR,
  };
  nextId += 1;
  textBoxes.push(box);
  selectTextBox(box.id);
}

function deleteSelectedTextBox() {
  if (!selectedId) {
    return;
  }
  textBoxes = textBoxes.filter((box) => box.id !== selectedId);
  selectedId = textBoxes.length ? textBoxes[textBoxes.length - 1].id : null;
  syncTextControls();
  redraw();
}

function renderToCanvas(targetCanvas, scale) {
  const targetCtx = targetCanvas.getContext("2d");
  targetCanvas.width = Math.round(currentImage.width * scale);
  targetCanvas.height = Math.round(currentImage.height * scale);
  targetCtx.drawImage(currentImage, 0, 0, targetCanvas.width, targetCanvas.height);

  textBoxes.forEach((box) => {
    drawTextBox(targetCtx, box, scale, false);
  });
}

function downloadMeme() {
  if (!currentImage) {
    return;
  }

  const exportCanvas = document.createElement("canvas");
  renderToCanvas(exportCanvas, 1);

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      alert("Could not export the meme. Please try again.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meme.png";
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

fileUpload.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  setActiveTemplate(null);
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    loadImageFromSource(loadEvent.target.result);
  };
  reader.readAsDataURL(file);
  fileUpload.value = "";
});

templateGrid.addEventListener("click", (event) => {
  const btn = event.target.closest(".template-btn");
  if (!btn) {
    return;
  }

  setActiveTemplate(btn);
  loadImageFromSource(btn.dataset.src);
});

addTextBtn.addEventListener("click", addTextBox);

textInput.addEventListener("input", (event) => {
  const selected = getSelectedTextBox();
  if (!selected) {
    return;
  }
  selected.text = event.target.value;
  syncLayerList();
  redraw();
});

fontSizeSlider.addEventListener("input", (event) => {
  const selected = getSelectedTextBox();
  if (!selected) {
    return;
  }
  selected.fontSize = Number(event.target.value);
  fontSizeValue.textContent = String(selected.fontSize);
  redraw();
});

textColorInput.addEventListener("input", (event) => {
  const selected = getSelectedTextBox();
  if (!selected) {
    return;
  }
  selected.color = event.target.value;
  colorHex.textContent = selected.color.toUpperCase();
  syncLayerList();
  redraw();
});

deleteTextBtn.addEventListener("click", deleteSelectedTextBox);
downloadBtn.addEventListener("click", downloadMeme);

canvas.addEventListener("mousedown", (event) => {
  if (!currentImage) {
    return;
  }

  const point = getCanvasPoint(event);
  const hit = hitTestTextBox(point.x, point.y);

  if (hit) {
    selectTextBox(hit.id);
    isDragging = true;
    canvas.classList.add("dragging");
    const imagePoint = toImageCoords(point.x, point.y);
    dragOffsetX = imagePoint.x - hit.x;
    dragOffsetY = imagePoint.y - hit.y;
  } else {
    selectedId = null;
    syncTextControls();
    redraw();
  }
});

canvas.addEventListener("mousemove", (event) => {
  if (!isDragging) {
    return;
  }

  const selected = getSelectedTextBox();
  if (!selected) {
    return;
  }

  const point = getCanvasPoint(event);
  const imagePoint = toImageCoords(point.x, point.y);
  selected.x = imagePoint.x - dragOffsetX;
  selected.y = imagePoint.y - dragOffsetY;
  redraw();
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  canvas.classList.remove("dragging");
});

window.addEventListener("resize", () => {
  if (currentImage) {
    resizeCanvas();
  }
});

setControlsEnabled(false);
