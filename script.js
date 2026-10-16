const input = document.querySelector('#sequenceInput');
const buildButton = document.querySelector('#buildButton');
const resetButton = document.querySelector('#resetButton');
const exampleButton = document.querySelector('#exampleButton');
const previousButton = document.querySelector('#previousButton');
const nextButton = document.querySelector('#nextButton');
const playButton = document.querySelector('#playButton');
const bucketList = document.querySelector('#bucketList');
const calculationBody = document.querySelector('#calculationBody');
const insertedCount = document.querySelector('#insertedCount');
const collisionCount = document.querySelector('#collisionCount');
const loadFactor = document.querySelector('#loadFactor');
const stepCount = document.querySelector('#stepCount');
const stepNumber = document.querySelector('#stepNumber');
const message = document.querySelector('#message');
const detailStatus = document.querySelector('#detailStatus');
const selectionHint = document.querySelector('#selectionHint');

const TABLE_SIZE = 13;
const REQUIRED_KEYS = 15;
const PLAY_INTERVAL = 720;
const EXAMPLE = [18, 31, 44, 7, 20, 33, 46, 5, 9, 22, 35, 48, 13, 26, 39];
let frames = [];
let frameIndex = 0;
let playTimer = null;
let selectedBucket = null;

function bucketFor(key) {
  return ((key % TABLE_SIZE) + TABLE_SIZE) % TABLE_SIZE;
}

function parseSequence(text) {
  const parts = text.trim().split(/[\s,，、]+/).filter(Boolean);
  if (parts.length !== REQUIRED_KEYS) {
    return { error: `目前輸入 ${parts.length} 個整數；請恰好輸入 ${REQUIRED_KEYS} 個。` };
  }
  const values = [];
  for (const part of parts) {
    if (!/^[+-]?\d+$/.test(part)) return { error: `「${part}」不是有效的整數。` };
    const value = Number(part);
    if (!Number.isSafeInteger(value)) return { error: `「${part}」超出 JavaScript 安全整數範圍。` };
    values.push(value);
  }
  return { values };
}

function cloneTable(table) {
  return table.map((chain) => [...chain]);
}

function makeFrames(values) {
  const table = Array.from({ length: TABLE_SIZE }, () => []);
  const rows = [];
  const result = [{
    table: cloneTable(table), rows: [], latestBucket: null, latestValue: null,
    message: '從空表開始。依序取出一筆輸入，計算 h(k)，再將該鍵接到對應桶子的串列尾端。',
  }];

  values.forEach((key, index) => {
    const bucket = bucketFor(key);
    const chain = table[bucket];
    const collision = chain.length > 0;
    const quotient = Math.floor(key / TABLE_SIZE);
    const remainder = key - quotient * TABLE_SIZE;
    const row = { index: index + 1, key, quotient, remainder, bucket, collision };
    chain.push(key);
    rows.push(row);
    const equation = `${key} = (${quotient} × 13) + ${remainder}`;
    const msg = collision
      ? `第 ${index + 1} 筆：${key} 除以 13 的餘數為 ${bucket}，落在桶 ${bucket}。該桶已有 ${chain.length - 1} 筆資料，發生碰撞；將 ${key} 接到串列尾端。`
      : `第 ${index + 1} 筆：${key} 除以 13 的餘數為 ${bucket}，落在桶 ${bucket}。該桶目前為空，建立第一個節點。`;
    result.push({
      table: cloneTable(table), rows: [...rows], latestBucket: bucket, latestValue: key,
      message: `${msg}（${equation}）`,
    });
  });
  return result;
}

function addText(parent, tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function drawBuckets(frame) {
  bucketList.replaceChildren();
  frame.table.forEach((chain, index) => {
    const row = document.createElement('div');
    row.className = `bucket-row${chain.length ? ' active' : ''}${selectedBucket === index ? ' selected' : ''}`;
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', chain.length ? `桶 ${index}，${chain.length} 個鍵值：${chain.join('，')}` : `桶 ${index}，空桶`);
    row.setAttribute('aria-pressed', String(selectedBucket === index));
    const bucketIndex = document.createElement('span');
    bucketIndex.className = 'bucket-index';
    addText(bucketIndex, 'b', '', String(index));
    const chainEl = document.createElement('div');
    chainEl.className = 'chain';
    if (!chain.length) {
      addText(chainEl, 'span', 'chain-empty', '∅　空桶');
    } else {
      chain.forEach((key, nodeIndex) => {
        if (nodeIndex) addText(chainEl, 'span', 'chain-arrow', '→');
        const node = addText(chainEl, 'span', `key-node${index === frame.latestBucket && key === frame.latestValue && nodeIndex === chain.length - 1 ? ' latest' : ''}`, String(key));
        node.title = `鍵值 ${key}，h(${key}) = ${index}`;
      });
    }
    row.append(bucketIndex, chainEl);
    const select = () => {
      selectedBucket = selectedBucket === index ? null : index;
      drawBuckets(frame);
      renderCalculations(frame);
      const rows = calculationBody.querySelectorAll('tr[data-bucket]');
      rows.forEach((calcRow) => calcRow.classList.toggle('current-row', selectedBucket !== null && Number(calcRow.dataset.bucket) === selectedBucket));
      selectionHint.textContent = selectedBucket === null ? '選取桶子以檢視詳細資訊' : `已選取桶 ${selectedBucket}：h(k) = ${selectedBucket}`;
      if (selectedBucket !== null) calculationBody.querySelector(`tr[data-bucket="${selectedBucket}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    row.addEventListener('click', select);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
    });
    bucketList.append(row);
  });
}

function renderCalculations(frame) {
  calculationBody.replaceChildren();
  if (!frame.rows.length) {
    const tr = document.createElement('tr');
    const td = addText(tr, 'td', 'table-empty', '開始逐筆插入後，這裡會列出每筆資料的計算過程。');
    td.colSpan = 5;
    calculationBody.append(tr);
    return;
  }
  frame.rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.dataset.bucket = String(row.bucket);
    if (row.index === frame.rows.length) tr.classList.add('current-row');
    addText(tr, 'td', '', String(row.index).padStart(2, '0'));
    addText(tr, 'td', '', String(row.key));
    addText(tr, 'td', '', `${row.key} = (${row.quotient} × 13) + ${row.remainder}`);
    addText(tr, 'td', '', `h(${row.key}) = ${row.bucket}`);
    addText(tr, 'td', row.collision ? 'collision-tag' : 'insert-tag', row.collision ? '碰撞・接尾' : '直接插入');
    calculationBody.append(tr);
  });
}

function renderFrame(index) {
  if (!frames.length) return;
  frameIndex = Math.max(0, Math.min(index, frames.length - 1));
  const frame = frames[frameIndex];
  drawBuckets(frame);
  renderCalculations(frame);
  const count = frame.rows.length;
  const collisions = frame.rows.filter((row) => row.collision).length;
  insertedCount.textContent = `${count} / ${REQUIRED_KEYS}`;
  collisionCount.textContent = String(collisions);
  loadFactor.textContent = (count / TABLE_SIZE).toFixed(2);
  stepCount.textContent = `${frameIndex + 1} / ${frames.length}`;
  stepNumber.textContent = count ? `第 ${count} / ${REQUIRED_KEYS} 筆` : '準備開始';
  message.textContent = frame.message;
  detailStatus.textContent = count ? `顯示 ${count} / 15 筆` : '等待插入';
  const last = frames.length - 1;
  previousButton.disabled = frameIndex <= 0 || Boolean(playTimer);
  nextButton.disabled = frameIndex >= last || Boolean(playTimer);
  playButton.disabled = frameIndex >= last && !playTimer;
  playButton.setAttribute('aria-pressed', String(Boolean(playTimer)));
  playButton.textContent = playTimer ? '■　停止播放' : '▶　自動播放';
}

function stopPlayback() {
  if (playTimer) window.clearInterval(playTimer);
  playTimer = null;
  if (frames.length) renderFrame(frameIndex);
}

function playNext() {
  if (frameIndex >= frames.length - 1) { stopPlayback(); return; }
  renderFrame(frameIndex + 1);
  if (frameIndex >= frames.length - 1) stopPlayback();
}

function buildTable() {
  const parsed = parseSequence(input.value);
  input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
  if (parsed.error) {
    message.textContent = parsed.error;
    stepNumber.textContent = '輸入格式錯誤';
    return;
  }
  stopPlayback();
  selectedBucket = null;
  selectionHint.textContent = '選取桶子以檢視詳細資訊';
  frames = makeFrames(parsed.values);
  renderFrame(0);
}

function reset() {
  stopPlayback();
  frames = makeFrames([]);
  frameIndex = 0;
  selectedBucket = null;
  input.setAttribute('aria-invalid', 'false');
  selectionHint.textContent = '選取桶子以檢視詳細資訊';
  renderFrame(0);
  stepNumber.textContent = '等待輸入';
  message.textContent = '建立後會顯示每個鍵的餘數、桶索引與碰撞狀況。';
  stepCount.textContent = '0 / 0';
  detailStatus.textContent = '尚未建立';
}

buildButton.addEventListener('click', buildTable);
exampleButton.addEventListener('click', () => {
  input.value = EXAMPLE.join(', ');
  buildTable();
});
resetButton.addEventListener('click', reset);
input.addEventListener('input', () => input.setAttribute('aria-invalid', 'false'));
previousButton.addEventListener('click', () => renderFrame(frameIndex - 1));
nextButton.addEventListener('click', () => renderFrame(frameIndex + 1));
playButton.addEventListener('click', () => {
  if (playTimer) { stopPlayback(); return; }
  if (frameIndex >= frames.length - 1) return;
  playTimer = window.setInterval(playNext, PLAY_INTERVAL);
  renderFrame(frameIndex);
});

frames = makeFrames(EXAMPLE);
renderFrame(frames.length - 1);
