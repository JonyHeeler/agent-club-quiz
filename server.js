import { createServer } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(root, 'dist');
const publicDir = resolve(root, 'public');
const port = 4173;
const mime = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function bankPath(filename) {
  if (typeof filename !== 'string' || !/^[\p{L}\p{N}_.-]+\.json$/u.test(filename) || filename.startsWith('.')) return null;
  return resolve(publicDir, filename);
}

function validateBank(bank) {
  if (!bank || typeof bank.title !== 'string' || !bank.title.trim() || !Array.isArray(bank.questions)) return '题库需要包含非空 title 和 questions 数组。';
  const ids = new Set();
  for (const [index, question] of bank.questions.entries()) {
    const label = `第 ${index + 1} 题`;
    if (!question || typeof question.id !== 'string' || !question.id.trim()) return `${label}缺少有效 id。`;
    if (ids.has(question.id)) return `题目 ID 重复：${question.id}`;
    ids.add(question.id);
    if (typeof question.question !== 'string' || !question.question.trim()) return `${label}缺少题干。`;
    if (!question.options || Object.keys(question.options).length !== 4 || ['A', 'B', 'C', 'D'].some((key) => typeof question.options[key] !== 'string' || !question.options[key].trim())) return `${label}必须包含 A、B、C、D 四个非空选项。`;
    if (!['A', 'B', 'C', 'D'].includes(question.answer)) return `${label}的答案必须是 A、B、C 或 D。`;
  }
  return null;
}

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('题库文件不能超过 1 MB。');
  }
  return JSON.parse(body);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/banks' && request.method === 'GET') {
      const files = (await readdir(publicDir, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json') && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
      return send(response, 200, files);
    }

    if (url.pathname === '/api/bank' && request.method === 'GET') {
      const filename = url.searchParams.get('file');
      const path = bankPath(filename);
      if (!path) return send(response, 400, { error: '题库文件名无效。' });
      try { return send(response, 200, await readFile(path, 'utf8')); }
      catch (error) { return send(response, error.code === 'ENOENT' ? 404 : 500, { error: '无法读取该题库文件。' }); }
    }

    if (url.pathname === '/api/bank' && request.method === 'PUT') {
      const filename = url.searchParams.get('file');
      const path = bankPath(filename);
      if (!path) return send(response, 400, { error: '题库文件名无效。' });
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') return send(response, 415, { error: '请求内容必须是 JSON。' });
      let bank;
      try { bank = await readBody(request); }
      catch (error) { return send(response, 400, { error: error.message || 'JSON 格式无法解析。' }); }
      const problem = validateBank(bank);
      if (problem) return send(response, 400, { error: problem });
      try { await writeFile(path, `${JSON.stringify(bank, null, 2)}\n`, 'utf8'); }
      catch { return send(response, 500, { error: '保存题库失败，请检查文件权限。' }); }
      return send(response, 200, { saved: filename });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { error: '不支持此请求方法。' });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return send(response, 400, 'Bad request', 'text/plain; charset=utf-8'); }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const path = resolve(dist, relative);
    if (path !== dist && !path.startsWith(`${dist}${sep}`)) return send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
    let content;
    try { content = await readFile(path); }
    catch (error) {
      if (error.code === 'ENOENT' && !extname(relative)) content = await readFile(resolve(dist, 'index.html'));
      else return send(response, 404, 'Not found', 'text/plain; charset=utf-8');
    }
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    if (!response.headersSent) send(response, 500, { error: '服务器处理请求时发生错误。' });
    else response.destroy();
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`端口 ${port} 正在使用，请关闭占用该端口的程序后重试。`);
  else console.error(error);
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0', () => console.log(`答题网站已启动：http://localhost:${port}（同一 Wi-Fi 下使用电脑局域网 IP）`));
