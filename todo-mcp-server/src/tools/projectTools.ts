// src/tools/projectTools.ts
// 프로젝트 + 마일스톤 관련 MCP 도구

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ProjectService } from '../services/projectService.js';
import type { TodoService } from '../services/todoService.js';

export function registerProjectTools(
  server: McpServer,
  projectService: ProjectService,
  todoService: TodoService,
): void {

  // ─── project_list ────────────────────────────────────

  server.registerTool(
    'project_list',
    {
      title: '프로젝트 목록 조회',
      description: `프로젝트 목록을 진행률과 함께 조회합니다.

Args:
  - status ('all'|'active'|'completed'|'on_hold'|'archived'): 상태 필터 (기본: 'all')

Returns:
  프로젝트 목록 (이름, 상태, 진행률 포함)`,
      inputSchema: {
        status: z.enum(['all', 'active', 'completed', 'on_hold', 'archived'])
          .default('all')
          .describe('프로젝트 상태 필터'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ status }) => {
      const filter = status === 'all' ? {} : { status };
      const projects = projectService.getAll(filter);

      if (projects.length === 0) {
        return { content: [{ type: 'text' as const, text: '등록된 프로젝트가 없습니다.' }] };
      }

      const lines = projects.map((p) => {
        const bar = makeProgressBar(p.progress_percent);    // 진행률 막대
        return `**[${p.id}] ${p.name}** (${p.status})\n  ${bar} ${p.progress_percent}% (${p.completed_tasks}/${p.total_tasks})`;
      });

      return { content: [{ type: 'text' as const, text: `## 프로젝트 (${projects.length}개)\n\n${lines.join('\n\n')}` }] };
    }
  );

  // ─── project_create ──────────────────────────────────

  server.registerTool(
    'project_create',
    {
      title: '프로젝트 생성',
      description: `새 프로젝트를 생성합니다.

Args:
  - name (string): 프로젝트 이름 (필수, 1~200자)
  - description (string): 설명 (선택)

Returns:
  생성된 프로젝트 정보`,
      inputSchema: {
        name: z.string().min(1).max(200).describe('프로젝트 이름'),
        description: z.string().max(1000).optional().describe('프로젝트 설명'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, description }) => {
      const project = projectService.create({ name, description });
      const text = `프로젝트를 생성했습니다.\n\n- ID: ${project.id}\n- 이름: ${project.name}${project.description ? `\n- 설명: ${project.description}` : ''}`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  // ─── project_status ──────────────────────────────────

  server.registerTool(
    'project_status',
    {
      title: '프로젝트 상태 조회',
      description: `프로젝트의 상세 상태를 조회합니다. 진행률, 마일스톤, 태스크 트리를 모두 포함합니다.

Args:
  - id (number): 프로젝트 ID (필수)

Returns:
  프로젝트 진행률, 마일스톤 현황, 태스크 트리`,
      inputSchema: {
        id: z.number().int().positive().describe('프로젝트 ID'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const project = projectService.getById(id);
        const milestones = projectService.getMilestones(id);
        const tree = todoService.getProjectTree(id);

        const lines: string[] = [];

        // 프로젝트 헤더
        const bar = makeProgressBar(project.progress_percent);
        lines.push(`## ${project.name}`);
        lines.push(`상태: ${project.status} | ${bar} ${project.progress_percent}% (${project.completed_tasks}/${project.total_tasks})`);
        if (project.description) lines.push(`\n${project.description}`);

        // 마일스톤
        if (milestones.length > 0) {
          lines.push('\n### 마일스톤');
          for (const m of milestones) {
            const mBar = makeProgressBar(m.progress_percent);
            const check = m.status === 'reached' ? '[x]' : '[ ]';
            lines.push(`- ${check} **${m.title}** (${m.target_date}) ${mBar} ${m.progress_percent}%`);
          }
        }

        // 태스크 트리
        if (tree.length > 0) {
          lines.push('\n### 태스크');
          for (const task of tree) {
            const check = task.status === 'completed' ? '[x]' : '[ ]';
            const due = task.due_date ? ` (마감: ${task.due_date})` : '';
            lines.push(`- ${check} **[${task.id}]** ${task.title} — P${task.priority}${due}`);
            for (const sub of task.subtasks) {
              const subCheck = sub.status === 'completed' ? '[x]' : '[ ]';
              const subDue = sub.due_date ? ` (마감: ${sub.due_date})` : '';
              lines.push(`  - ${subCheck} **[${sub.id}]** ${sub.title} — P${sub.priority}${subDue}`);
            }
          }
        } else {
          lines.push('\n아직 태스크가 없습니다. "이 프로젝트 태스크 쪼개줘"라고 요청해보세요.');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : '오류';
        return { content: [{ type: 'text' as const, text: `프로젝트 조회 실패: ${msg}` }], isError: true };
      }
    }
  );

  // ─── project_update ──────────────────────────────────

  server.registerTool(
    'project_update',
    {
      title: '프로젝트 수정',
      description: `프로젝트 정보를 수정합니다. 상태 변경(완료, 보류 등)도 이 도구로 합니다.

Args:
  - id (number): 프로젝트 ID (필수)
  - name (string): 새 이름 (선택)
  - description (string): 새 설명 (선택)
  - status ('active'|'completed'|'on_hold'|'archived'): 새 상태 (선택)

Returns:
  수정된 프로젝트 정보`,
      inputSchema: {
        id: z.number().int().positive().describe('프로젝트 ID'),
        name: z.string().min(1).max(200).optional().describe('새 이름'),
        description: z.string().max(1000).nullable().optional().describe('새 설명'),
        status: z.enum(['active', 'completed', 'on_hold', 'archived']).optional().describe('새 상태'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, ...data }) => {
      try {
        const project = projectService.update(id, data);
        return { content: [{ type: 'text' as const, text: `프로젝트 [${id}] "${project.name}" 수정 완료. 상태: ${project.status}` }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : '오류';
        return { content: [{ type: 'text' as const, text: `프로젝트 수정 실패: ${msg}` }], isError: true };
      }
    }
  );

  // ─── milestone_create ────────────────────────────────

  server.registerTool(
    'milestone_create',
    {
      title: '마일스톤 생성',
      description: `프로젝트에 마일스톤(중간 목표)을 추가합니다.

Args:
  - project_id (number): 프로젝트 ID (필수)
  - title (string): 마일스톤 제목 (필수)
  - target_date (string): 목표 날짜 YYYY-MM-DD (필수)

Returns:
  생성된 마일스톤 정보`,
      inputSchema: {
        project_id: z.number().int().positive().describe('프로젝트 ID'),
        title: z.string().min(1).max(200).describe('마일스톤 제목'),
        target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('목표 날짜 (YYYY-MM-DD)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ project_id, title, target_date }) => {
      try {
        const m = projectService.createMilestone({ project_id, title, target_date });
        return { content: [{ type: 'text' as const, text: `마일스톤 생성: [${m.id}] "${m.title}" (목표: ${m.target_date})` }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : '오류';
        return { content: [{ type: 'text' as const, text: `마일스톤 생성 실패: ${msg}` }], isError: true };
      }
    }
  );

  // ─── milestone_complete ──────────────────────────────

  server.registerTool(
    'milestone_complete',
    {
      title: '마일스톤 완료/취소',
      description: `마일스톤을 완료 처리하거나 되돌립니다.

Args:
  - id (number): 마일스톤 ID (필수)
  - undo (boolean): true이면 미완료로 되돌림 (기본: false)`,
      inputSchema: {
        id: z.number().int().positive().describe('마일스톤 ID'),
        undo: z.boolean().default(false).describe('true이면 되돌림'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, undo }) => {
      try {
        const m = projectService.completeMilestone(id, undo);
        const action = undo ? '미완료로 되돌림' : '달성 완료';
        return { content: [{ type: 'text' as const, text: `마일스톤 [${id}] "${m.title}" ${action}.` }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : '오류';
        return { content: [{ type: 'text' as const, text: `마일스톤 처리 실패: ${msg}` }], isError: true };
      }
    }
  );
}

// ─── 유틸리티 ──────────────────────────────────────────

/** 텍스트 진행률 막대 생성 */
function makeProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);     // 0~10
  const empty = 10 - filled;
  return `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;
}
