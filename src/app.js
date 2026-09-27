import './style.css';
import logoUrl from '../img/logo.png';

const app = document.querySelector('#app');
const letters = ['A', 'B', 'C', 'D'];
let bank;
let normalQuestions = [];
let bankFile;
let bankFiles = [];
let debugBank;
let debugMode = false;
let debugDirty = false;
let quizMode = 'normal';
let round = [];
let answers = [];
let current = 0;
let logoClicks = 0;
let lastLogoClick = 0;
const questionCycles = new Set();
const settingsKey = 'quiz-settings';
let quizSettings = loadSettings();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    return {
      groupSize: Number.isInteger(saved.groupSize) && saved.groupSize > 0 ? saved.groupSize : 5,
      difficulty: ['easy', 'medium', 'hard'].includes(saved.difficulty) ? saved.difficulty : 'medium',
      avoidRepeats: saved.avoidRepeats !== false,
      showProgress: saved.showProgress !== false
    };
  } catch {
    return { groupSize: 5, difficulty: 'medium', avoidRepeats: true, showProgress: true };
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function validateBank(data, minimum = 5) {
  if (!data || typeof data.title !== 'string' || !data.title.trim() || !Array.isArray(data.questions)) {
    throw new Error('题库需要包含非空 title 和 questions 数组。');
  }
  if (data.questions.length < minimum) throw new Error(`题库至少需要 ${minimum} 道题。`);
  const ids = new Set();
  data.questions.forEach((item, index) => {
    const label = `第 ${index + 1} 题`;
    if (!item || typeof item.id !== 'string' || !item.id.trim()) throw new Error(`${label}缺少有效 id。`);
    if (ids.has(item.id)) throw new Error(`题目 ID 重复：${item.id}`);
    ids.add(item.id);
    if (typeof item.question !== 'string' || !item.question.trim()) throw new Error(`${label}缺少题干。`);
    if (!item.options || Object.keys(item.options).length !== 4 || letters.some((key) => typeof item.options[key] !== 'string' || !item.options[key].trim())) {
      throw new Error(`${label}必须包含 A、B、C、D 四个非空选项。`);
    }
    if (!letters.includes(item.answer)) throw new Error(`${label}的答案必须是 A、B、C 或 D。`);
  });
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function logoMarkup(className = 'club-logo') {
  return `<img class="${className}" src="${logoUrl}" alt="AI 智能体 + 协会标志" data-logo-debug />`;
}

function renderWelcome() {
  const ready = bank.questions.length >= 1;
  app.innerHTML = `
    <section class="card welcome-card">
      ${logoMarkup()}
      <h1>欢迎来到百团大战</h1>
      <button class="button button-primary button-wide" data-action="start" ${ready ? '' : 'disabled'}>开始答题 <span aria-hidden="true">→</span></button>
      ${ready ? '' : '<p class="small-note">题库不足 5 道题，请进入调试模式检查题库</p>'}
    </section>`;
  app.querySelector('[data-action="start"]').addEventListener('click', startRound);
}

function startRound() {
  quizMode = 'normal';
  const size = Math.min(quizSettings.groupSize, normalQuestions.length);
  let available = quizSettings.avoidRepeats
    ? normalQuestions.filter((question) => !questionCycles.has(`${question.sourceFile}:${question.id}`))
    : normalQuestions;
  if (available.length < size) {
    questionCycles.clear();
    available = normalQuestions;
  }

  const hard = available.filter((question) => question.sourceFile === 'questions5.json');
  const other = available.filter((question) => question.sourceFile !== 'questions5.json');
  const ratio = { easy: 0.2, medium: 0.5, hard: 0.8 }[quizSettings.difficulty];
  const hardCount = Math.min(hard.length, Math.round(size * ratio));
  round = [...shuffle(hard).slice(0, hardCount), ...shuffle(other).slice(0, size - hardCount)];
  if (round.length < size) {
    const selected = new Set(round.map((question) => `${question.sourceFile}:${question.id}`));
    round.push(...shuffle(available.filter((question) => !selected.has(`${question.sourceFile}:${question.id}`))).slice(0, size - round.length));
  }
  round = shuffle(round);
  if (quizSettings.avoidRepeats) round.forEach((question) => questionCycles.add(`${question.sourceFile}:${question.id}`));
  answers = Array(round.length).fill(null);
  current = 0;
  renderQuestion();
}

function startDebugRound() {
  if (!debugBank.questions.length) return;
  quizMode = 'debug';
  round = debugBank.questions.map((question) => ({ ...question, options: { ...question.options } }));
  answers = Array(round.length).fill(null);
  current = 0;
  renderQuestion();
}

function renderQuestion() {
  const item = round[current];
  const selected = answers[current];
  const total = round.length;
  app.innerHTML = `
    <section class="quiz-layout">
      <header class="quiz-header">
        <a class="wordmark" href="#" data-action="home" aria-label="返回首页"><span data-logo-debug>${logoMarkup('wordmark-logo')}</span>AI 智能体 + 协会</a>
        ${quizMode === 'debug' ? '<span class="round-label">调试试做</span>' : ''}
      </header>
      <div class="card question-card">
        ${quizMode === 'debug' || quizSettings.showProgress ? `<div class="progress-row"><span>第 ${current + 1} <span class="muted">/ ${total} 题</span></span></div>
        <div class="progress-track" role="progressbar" aria-label="答题进度" aria-valuenow="${current}" aria-valuemin="0" aria-valuemax="${total}"><span style="width:${(current / total) * 100}%"></span></div>` : ''}
        <h1 class="question-title">${escapeHtml(item.question)}</h1>
        <div class="option-list" role="radiogroup" aria-label="选择一个答案">
          ${letters.map((letter) => `<button type="button" class="option${selected === letter ? ' is-selected' : ''}" role="radio" aria-checked="${selected === letter}" data-option="${letter}"><span class="option-letter">${letter}</span><span class="option-text">${escapeHtml(item.options[letter])}</span><span class="option-check" aria-hidden="true">${selected === letter ? '✓' : ''}</span></button>`).join('')}
        </div>
        <div class="question-footer">
          <button type="button" class="button button-quiet" data-action="back" ${current === 0 ? 'disabled' : ''}>上一步</button>
          <button type="button" class="button button-primary" data-action="next" ${selected ? '' : 'disabled'}>${current === total - 1 ? '提交并查看成绩' : '下一题'} <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>`;
  fitQuestionTitle();
  app.querySelectorAll('[data-option]').forEach((button) => button.addEventListener('click', () => {
    answers[current] = button.dataset.option;
    renderQuestion();
  }));
  app.querySelector('[data-action="back"]').addEventListener('click', () => { if (current > 0) { current -= 1; renderQuestion(); } });
  app.querySelector('[data-action="next"]').addEventListener('click', () => {
    if (!answers[current]) return;
    if (current === total - 1) renderResult();
    else { current += 1; renderQuestion(); }
  });
  app.querySelector('[data-action="home"]').addEventListener('click', (event) => {
    event.preventDefault();
    if (quizMode === 'debug') { renderDebug(); return; }
    if (window.confirm('返回首页并放弃本轮答题？')) renderWelcome();
  });
}

function fitQuestionTitle() {
  const title = app.querySelector('.question-title');
  if (!title) return;
  let min = 16;
  let max = 34;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const size = (min + max) / 2;
    title.style.fontSize = `${size}px`;
    if (title.scrollHeight <= title.clientHeight) min = size;
    else max = size;
  }
  title.style.fontSize = `${min}px`;
}

window.addEventListener('resize', fitQuestionTitle);

function renderResult() {
  const score = round.reduce((total, item, index) => total + (answers[index] === item.answer ? 1 : 0), 0);
  if (quizMode === 'debug') {
    app.innerHTML = `
      <section class="card result-card">
        <div class="result-mark" aria-hidden="true">✓</div>
        <h1>试做完成</h1>
        <p class="score"><strong>${score}</strong><span> / ${round.length} 题答对</span></p>
        <p class="result-copy">题库：${escapeHtml(bankFile)}</p>
        <button class="button button-primary button-wide" data-action="review">查看本组答题复盘</button>
        <button class="button button-primary button-wide" data-action="again">重新试做此题库 <span aria-hidden="true">→</span></button>
        <button class="button button-quiet home-button" data-action="editor">返回题库编辑</button>
      </section>`;
    app.querySelector('[data-action="review"]').addEventListener('click', renderReview);
    app.querySelector('[data-action="again"]').addEventListener('click', startDebugRound);
    app.querySelector('[data-action="editor"]').addEventListener('click', renderDebug);
    return;
  }
  app.innerHTML = `
    <section class="card result-card">
      <div class="result-mark" aria-hidden="true">✓</div>
      <h1>答题完成</h1>
      <p class="score"><strong>${score}</strong><span> / ${round.length} 题答对</span></p>
      <button class="button button-primary button-wide" data-action="again">下一组，开始答题 <span aria-hidden="true">→</span></button>
      <button class="button button-secondary button-wide" data-action="review">查看本组答题复盘</button>
      <button class="button button-quiet home-button" data-action="home">返回首页</button>
    </section>`;
  app.querySelector('[data-action="review"]').addEventListener('click', renderReview);
  app.querySelector('[data-action="again"]').addEventListener('click', startRound);
  app.querySelector('[data-action="home"]').addEventListener('click', renderWelcome);
}

function renderReview() {
  const score = round.reduce((total, item, index) => total + (answers[index] === item.answer ? 1 : 0), 0);
  app.innerHTML = `
    <section class="quiz-layout">
      <header class="quiz-header">
        <a class="wordmark" href="#" data-action="home" aria-label="返回首页"><span>${logoMarkup('wordmark-logo')}</span>AI 智能体 + 协会</a>
        <span class="round-label">${score} / ${round.length} 题答对</span>
      </header>
      <div class="card review-card">
        <h1>本组答题复盘</h1>
        <ol class="review-list">
          ${round.map((item, index) => `
            <li class="review-item">
              <h2>${escapeHtml(item.question)}</h2>
              <p class="review-answer${answers[index] === item.answer ? ' is-correct' : ' is-wrong'}"><strong>本组选择</strong>：${answers[index]}. ${escapeHtml(item.options[answers[index]])}</p>
              <p class="review-answer is-correct"><strong>正确答案</strong>：${item.answer}. ${escapeHtml(item.options[item.answer])}</p>
            </li>`).join('')}
        </ol>
        <div class="review-actions">
          <button class="button button-quiet" data-action="result">返回成绩</button>
          ${quizMode === 'debug'
            ? '<button class="button button-primary" data-action="editor">返回题库编辑</button>'
            : '<button class="button button-primary" data-action="again">下一组，开始答题 →</button>'}
        </div>
      </div>
    </section>`;
  app.querySelector('[data-action="result"]').addEventListener('click', renderResult);
  app.querySelector('[data-action="again"]')?.addEventListener('click', startRound);
  app.querySelector('[data-action="editor"]')?.addEventListener('click', renderDebug);
}

async function fetchBank(filename) {
  const response = await fetch(`/api/bank?file=${encodeURIComponent(filename)}&t=${Date.now()}`, { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `读取题库失败（HTTP ${response.status}）。`);
  validateBank(result, 0);
  return result;
}

async function refreshQuizBank() {
  const banks = await Promise.all(bankFiles.map(fetchBank));
  normalQuestions = banks.flatMap((item, index) => item.questions.map((question) => ({ ...question, sourceFile: bankFiles[index] })));
  bank = { title: '欢迎来到百团大战', questions: normalQuestions };
  quizSettings.groupSize = Math.min(quizSettings.groupSize, Math.max(1, normalQuestions.length));
  questionCycles.clear();
}

async function enterDebug() {
  if (debugMode) return;
  debugMode = true;
  app.innerHTML = '<section class="card loading-card" role="status">正在读取题库列表…</section>';
  try {
    const response = await fetch('/api/banks', { cache: 'no-store' });
    if (!response.ok) throw new Error(`题库列表加载失败（HTTP ${response.status}）。`);
    bankFiles = await response.json();
    if (!bankFiles.length) throw new Error('public 文件夹里没有 JSON 题库。');
    if (!bankFiles.includes(bankFile)) bankFile = bankFiles[0];
    debugBank = await fetchBank(bankFile);
    debugDirty = false;
    renderDebug();
  } catch (error) {
    renderError(`调试模式无法加载题库：${error.message}`);
  }
}

function questionEditor(question, index) {
  const optionFields = letters.map((letter) => `<label class="editor-field"><span>选项 ${letter}</span><input data-option="${letter}" value="${escapeHtml(question.options[letter])}" required /></label>`).join('');
  return `<details class="edit-question" data-index="${index}">
    <summary><span class="edit-number">${String(index + 1).padStart(2, '0')}</span><span class="edit-summary">${escapeHtml(question.question || '（未填写题目）')}</span><span class="edit-answer">答案 ${escapeHtml(question.answer || '—')}</span></summary>
    <div class="editor-fields">
      <label class="editor-field"><span>题目 ID</span><input data-field="id" value="${escapeHtml(question.id)}" required /></label>
      <label class="editor-field"><span>题目内容</span><textarea data-field="question" rows="2" required>${escapeHtml(question.question)}</textarea></label>
      ${optionFields}
      <label class="editor-field answer-field"><span>正确答案</span><select data-field="answer">${letters.map((letter) => `<option value="${letter}" ${question.answer === letter ? 'selected' : ''}>${letter}</option>`).join('')}</select></label>
      <button type="button" class="button button-delete" data-action="delete" data-index="${index}">删除这道题</button>
    </div>
  </details>`;
}

function renderDebug() {
  if (!debugBank) return;
  app.innerHTML = `
    <section class="quiz-layout debug-layout">
      <header class="quiz-header"><button class="button button-quiet debug-exit" data-action="exit">← 退出调试</button></header>
      <div class="card debug-card">
        <h1>题库调试</h1>
        <section class="quiz-settings" aria-labelledby="settings-title">
          <div class="settings-heading"><h2 id="settings-title">答题设置</h2><button type="button" class="button button-save" data-action="save-settings" disabled>保存设置</button></div>
          <div class="settings-grid">
            <label class="editor-field"><span>每组题目数量</span><input type="number" data-setting="groupSize" min="1" max="${Math.max(normalQuestions.length, 1)}" value="${Math.min(quizSettings.groupSize, Math.max(normalQuestions.length, 1))}" required /></label>
            <label class="editor-field"><span>题目难度</span><select data-setting="difficulty"><option value="easy" ${quizSettings.difficulty === 'easy' ? 'selected' : ''}>简单 · 约 20% 来自进阶题</option><option value="medium" ${quizSettings.difficulty === 'medium' ? 'selected' : ''}>中等 · 约 50% 来自进阶题</option><option value="hard" ${quizSettings.difficulty === 'hard' ? 'selected' : ''}>困难 · 约 80% 来自进阶题</option></select></label>
          </div>
          <p class="settings-note">进阶题来自 questions5.json（${normalQuestions.filter((question) => question.sourceFile === 'questions5.json').length} 题），题库不足时自动补足。</p>
          <label class="setting-toggle"><input type="checkbox" data-setting="avoidRepeats" ${quizSettings.avoidRepeats ? 'checked' : ''} /><span><strong>组间尽量不重复</strong><small>题目用完后自动开始新一轮</small></span></label>
          <label class="setting-toggle"><input type="checkbox" data-setting="showProgress" ${quizSettings.showProgress ? 'checked' : ''} /><span><strong>显示答题进度</strong><small>在答题页显示当前题号和进度条</small></span></label>
          <span class="settings-status" data-settings-status>设置保存在本机浏览器</span>
        </section>
        <div class="debug-controls">
          <label class="editor-field bank-select-field"><span>选择题库</span><select data-action="select-bank">${bankFiles.map((filename) => `<option value="${escapeHtml(filename)}" ${filename === bankFile ? 'selected' : ''}>${escapeHtml(filename)}</option>`).join('')}</select></label>
          <span class="question-count">${debugBank.questions.length} 道题</span>
        </div>
        <p class="save-status${debugDirty ? ' is-dirty' : ''}" data-save-status>${debugDirty ? '有未保存的修改' : '编辑或删除题目后，记得保存题库。'}</p>
        <div class="debug-actions">
          <button type="button" class="button button-primary" data-action="try" ${debugBank.questions.length ? '' : 'disabled'}>试做全部 ${debugBank.questions.length} 题</button>
          <button type="button" class="button button-save" data-action="save" ${debugDirty ? '' : 'disabled'}>保存修改</button>
        </div>
        <div class="editor-list">${debugBank.questions.length ? debugBank.questions.map(questionEditor).join('') : '<p class="empty-bank">题库里还没有题目。</p>'}</div>
      </div>
      <p class="footer-note">保存会直接更新 public/${escapeHtml(bankFile)}</p>
    </section>`;

  app.querySelector('[data-action="exit"]').addEventListener('click', exitDebug);
  app.querySelector('[data-action="try"]').addEventListener('click', startDebugRound);
  app.querySelector('[data-action="save"]').addEventListener('click', saveDebugBank);
  app.querySelectorAll('[data-setting]').forEach((input) => input.addEventListener('input', () => {
    const button = app.querySelector('[data-action="save-settings"]');
    if (button) button.disabled = false;
    const status = app.querySelector('[data-settings-status]');
    if (status) status.textContent = '设置尚未保存';
  }));
  app.querySelector('[data-action="save-settings"]').addEventListener('click', saveQuizSettings);
  app.querySelector('[data-action="select-bank"]').addEventListener('change', changeDebugBank);
  app.querySelectorAll('.edit-question').forEach((details) => {
    const index = Number(details.dataset.index);
    details.addEventListener('input', (event) => updateQuestion(index, event.target));
    details.addEventListener('change', (event) => updateQuestion(index, event.target));
  });
  app.querySelectorAll('[data-action="delete"]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.index);
    if (!window.confirm(`删除第 ${index + 1} 题？保存后会从题库文件中移除。`)) return;
    debugBank.questions.splice(index, 1);
    markDirty();
    renderDebug();
  }));
}

function saveQuizSettings() {
  const sizeInput = app.querySelector('[data-setting="groupSize"]');
  const size = Number(sizeInput.value);
  if (!Number.isInteger(size) || size < 1 || size > normalQuestions.length) {
    sizeInput.setCustomValidity(`请输入 1 到 ${normalQuestions.length} 之间的题目数量。`);
    sizeInput.reportValidity();
    return;
  }
  sizeInput.setCustomValidity('');
  quizSettings = {
    groupSize: size,
    difficulty: app.querySelector('[data-setting="difficulty"]').value,
    avoidRepeats: app.querySelector('[data-setting="avoidRepeats"]').checked,
    showProgress: app.querySelector('[data-setting="showProgress"]').checked
  };
  localStorage.setItem(settingsKey, JSON.stringify(quizSettings));
  questionCycles.clear();
  app.querySelector('[data-action="save-settings"]').disabled = true;
  app.querySelector('[data-settings-status]').textContent = '设置已保存';
}

function updateQuestion(index, input) {
  const question = debugBank.questions[index];
  if (!question) return;
  if (input.dataset.option) question.options[input.dataset.option] = input.value;
  else if (input.dataset.field) question[input.dataset.field] = input.value;
  if (input.dataset.field === 'answer') {
    const summary = input.closest('.edit-question').querySelector('.edit-answer');
    summary.textContent = `答案 ${input.value}`;
  }
  if (input.dataset.field === 'question') {
    input.closest('.edit-question').querySelector('.edit-summary').textContent = input.value || '（未填写题目）';
  }
  markDirty();
}

function markDirty() {
  debugDirty = true;
  const status = app.querySelector('[data-save-status]');
  if (status) { status.textContent = '有未保存的修改'; status.classList.add('is-dirty'); }
  const save = app.querySelector('[data-action="save"]');
  if (save) save.disabled = false;
}

async function saveDebugBank() {
  const save = app.querySelector('[data-action="save"]');
  try {
    validateBank(debugBank, 0);
    save.disabled = true;
    save.textContent = '正在保存…';
    const response = await fetch(`/api/bank?file=${encodeURIComponent(bankFile)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(debugBank)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '保存失败。');
    debugDirty = false;
    const status = app.querySelector('[data-save-status]');
    status.textContent = `已保存到 public/${result.saved}`;
    status.classList.remove('is-dirty');
    save.textContent = '保存修改';
  } catch (error) {
    window.alert(`保存失败：${error.message}`);
    const button = app.querySelector('[data-action="save"]');
    button.disabled = false;
    button.textContent = '保存修改';
  }
}

async function changeDebugBank(event) {
  const filename = event.target.value;
  if (debugDirty && !window.confirm('切换题库会丢弃尚未保存的修改，继续吗？')) {
    event.target.value = bankFile;
    return;
  }
  event.target.disabled = true;
  try {
    debugBank = await fetchBank(filename);
    bankFile = filename;
    debugDirty = false;
    renderDebug();
  } catch (error) {
    window.alert(`无法打开题库：${error.message}`);
    event.target.value = bankFile;
    event.target.disabled = false;
  }
}

async function exitDebug() {
  const discardChanges = debugDirty;
  if (discardChanges && !window.confirm('还有未保存的修改，退出并放弃这些修改？')) return;
  debugMode = false;
  debugDirty = false;
  try {
    await refreshQuizBank();
    if (bank.questions.length) renderWelcome();
    else renderError('题库为空，无法开始答题。请在调试模式中添加题目。');
  } catch (error) {
    renderError(`题库重新加载失败：${error.message}`);
  }
}

function renderError(message) {
  app.innerHTML = `<section class="card error-card">${logoMarkup()}<div class="error-mark" aria-hidden="true">!</div><h1>无法开始答题</h1><p class="error-copy">${escapeHtml(message)}</p><button class="button button-primary button-wide" data-action="retry">重新加载题库</button><button class="button button-quiet home-button" data-action="debug">进入调试模式</button></section>`;
  app.querySelector('[data-action="retry"]').addEventListener('click', loadBank);
  app.querySelector('[data-action="debug"]').addEventListener('click', enterDebug);
}

async function loadBank() {
  app.innerHTML = '<section class="card loading-card" role="status">正在准备题库…</section>';
  try {
    const response = await fetch('/api/banks', { cache: 'no-store' });
    if (!response.ok) throw new Error(`题库列表加载失败（HTTP ${response.status}）。`);
    bankFiles = await response.json();
    if (!bankFiles.length) throw new Error('public 文件夹里没有 JSON 题库。');
    bankFile = bankFiles[0];
    await refreshQuizBank();
    validateBank(bank, 5);
    renderWelcome();
  } catch (error) {
    const message = error instanceof SyntaxError ? 'JSON 格式无法解析，请检查标点和引号。' : error.message || '请检查网络后重试。';
    renderError(message);
  }
}

app.addEventListener('click', (event) => {
  if (!event.target.closest('[data-logo-debug]')) return;
  const now = Date.now();
  logoClicks = now - lastLogoClick > 1800 ? 1 : logoClicks + 1;
  lastLogoClick = now;
  if (logoClicks >= 3) { logoClicks = 0; enterDebug(); }
});

loadBank();
