#!/usr/bin/env node
// src/index.ts
// MCP 서버 엔트리포인트
// stdio: Claude 앱 | HTTP: 웹앱 REST + MCP

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { getDb } from './db/init.js';
import { TodoService } from './services/todoService.js';
import { ProjectService } from './services/projectService.js';
import { registerTodoTools } from './tools/todoTools.js';
import { registerProjectTools } from './tools/projectTools.js';

const server = new McpServer({
  name: 'todo-mcp-server',
  version: '2.0.0',
});

// ─── stdio 모드 ────────────────────────────────────────

async function runStdio(): Promise<void> {
  const db = await getDb();
  const todoService = new TodoService(db);
  const projectService = new ProjectService(db);

  // MCP 도구 등록 (12개)
  registerTodoTools(server, todoService);
  registerProjectTools(server, projectService, todoService);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[todo-mcp-server] stdio 모드 실행 중 (도구 12개)');
}

// ─── HTTP 모드 ─────────────────────────────────────────

async function runHTTP(): Promise<void> {
  const db = await getDb();
  const todoService = new TodoService(db);
  const projectService = new ProjectService(db);

  registerTodoTools(server, todoService);
  registerProjectTools(server, projectService, todoService);

  const app = express();

  // CORS 허용 — 웹앱(file:// 또는 다른 포트)에서 접근 가능
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  app.use(express.json());

  // MCP 엔드포인트
  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, enableJsonResponse: true,
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // ─── REST API (웹앱용) ────────────────────────────────

  // 프로젝트
  app.get('/api/projects', (_req, res) => {
    const { status } = _req.query as { status?: string };
    res.json(projectService.getAll(status ? { status } : {}));
  });

  app.post('/api/projects', (req, res) => {
    try { res.status(201).json(projectService.create(req.body)); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  app.get('/api/projects/:id', (req, res) => {
    try { res.json(projectService.getById(parseInt(req.params.id, 10))); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  app.put('/api/projects/:id', (req, res) => {
    try { res.json(projectService.update(parseInt(req.params.id, 10), req.body)); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  // 마일스톤
  app.get('/api/projects/:id/milestones', (req, res) => {
    try { res.json(projectService.getMilestones(parseInt(req.params.id, 10))); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  app.post('/api/milestones', (req, res) => {
    try { res.status(201).json(projectService.createMilestone(req.body)); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  // 투두
  app.get('/api/todos', (_req, res) => {
    const { status, project_id, standalone } = _req.query as Record<string, string>;
    if (standalone === 'true') { res.json(todoService.getStandalone({ status })); return; }
    res.json(todoService.getAll({ status, project_id: project_id ? parseInt(project_id, 10) : undefined }));
  });

  app.post('/api/todos', (req, res) => {
    try { res.status(201).json(todoService.create(req.body)); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  app.put('/api/todos/:id', (req, res) => {
    try { res.json(todoService.update(parseInt(req.params.id, 10), req.body)); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  app.delete('/api/todos/:id', (req, res) => {
    try { res.json(todoService.delete(parseInt(req.params.id, 10))); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  app.patch('/api/todos/:id/status', (req, res) => {
    try { res.json(todoService.updateStatus(parseInt(req.params.id, 10), req.body.status)); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  // 프로젝트 트리 (태스크 + 서브태스크)
  app.get('/api/projects/:id/tree', (req, res) => {
    try { res.json(todoService.getProjectTree(parseInt(req.params.id, 10))); }
    catch (e: unknown) { const err = e as { statusCode?: number; message: string }; res.status(err.statusCode || 400).json({ error: err.message }); }
  });

  // 위젯
  app.get('/api/widget', (_req, res) => {
    const pending = todoService.getAll({ status: 'pending' });
    const projects = projectService.getAll({ status: 'active' });
    res.json({
      pending_todos: pending.todos.slice(0, 10).map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date })),
      active_projects: projects.map((p) => ({ id: p.id, name: p.name, progress_percent: p.progress_percent })),
      summary: { pending_count: pending.totalCount, active_projects_count: projects.length },
    });
  });

  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

  const port = parseInt(process.env.PORT || '3001', 10);
  app.listen(port, () => {
    console.error(`[todo-mcp-server] HTTP 모드: http://localhost:${port}`);
  });
}

// ─── 실행 ──────────────────────────────────────────────

const transport = process.env.TRANSPORT || 'stdio';
if (transport === 'http') {
  runHTTP().catch((e) => { console.error('에러:', e); process.exit(1); });
} else {
  runStdio().catch((e) => { console.error('에러:', e); process.exit(1); });
}
