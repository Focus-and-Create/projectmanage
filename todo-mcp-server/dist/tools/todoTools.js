// src/tools/todoTools.ts
// 투두 관련 MCP 도구 — 3단계 계층 + 태스크 쪼개기
import { z } from 'zod';
export function registerTodoTools(server, todoService) {
    // ─── todo_list ───────────────────────────────────────
    server.registerTool('todo_list', {
        title: '투두 목록 조회',
        description: `투두 목록을 조회합니다. 프로젝트별, 상태별 필터링 가능.
프로젝트 미소속 단독 투두만 보려면 standalone=true.

Args:
  - status ('all'|'pending'|'completed'): 상태 필터 (기본: 'all')
  - project_id (number): 프로젝트 ID로 필터 (선택)
  - standalone (boolean): true이면 프로젝트 미소속 단독 투두만 (기본: false)

Returns:
  투두 목록 (계층 구조 포함)`,
        inputSchema: {
            status: z.enum(['all', 'pending', 'completed']).default('all').describe('상태 필터'),
            project_id: z.number().int().positive().optional().describe('프로젝트 ID'),
            standalone: z.boolean().default(false).describe('단독 투두만 조회'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ status, project_id, standalone }) => {
        const statusFilter = status === 'all' ? undefined : status;
        if (standalone) {
            // 단독 투두만
            const result = todoService.getStandalone({ status: statusFilter });
            if (result.totalCount === 0) {
                return { content: [{ type: 'text', text: '단독 투두가 없습니다.' }] };
            }
            const lines = result.todos.map((t) => formatTodo(t));
            return { content: [{ type: 'text', text: `## 단독 투두 (${result.totalCount}개)\n\n${lines.join('\n')}` }] };
        }
        if (project_id) {
            // 프로젝트 태스크 트리
            const tree = todoService.getProjectTree(project_id);
            if (tree.length === 0) {
                return { content: [{ type: 'text', text: '이 프로젝트에 태스크가 없습니다.' }] };
            }
            const lines = tree.flatMap((task) => {
                const taskLine = formatTodo(task);
                const subLines = task.subtasks.map((sub) => `  ${formatTodo(sub)}`);
                return [taskLine, ...subLines];
            });
            return { content: [{ type: 'text', text: `## 프로젝트 태스크\n\n${lines.join('\n')}` }] };
        }
        // 전체 투두
        const result = todoService.getAll({ status: statusFilter });
        if (result.totalCount === 0) {
            return { content: [{ type: 'text', text: '투두가 없습니다.' }] };
        }
        const lines = result.todos.map((t) => formatTodo(t));
        return { content: [{ type: 'text', text: `## 전체 투두 (${result.totalCount}개)\n\n${lines.join('\n')}` }] };
    });
    // ─── todo_create ─────────────────────────────────────
    server.registerTool('todo_create', {
        title: '투두 생성',
        description: `투두를 생성합니다.
- project_id 없으면 단독 투두
- project_id 있으면 프로젝트 태스크
- parent_id 있으면 서브태스크 (최대 3단계)

Args:
  - title (string): 제목 (필수, 1~200자)
  - description (string): 설명 (선택)
  - priority (number): 1~5, 기본 3
  - due_date (string): YYYY-MM-DD (선택)
  - project_id (number): 프로젝트 ID (선택)
  - parent_id (number): 부모 태스크 ID (선택, 서브태스크 생성 시)
  - milestone_id (number): 마일스톤 ID (선택)`,
        inputSchema: {
            title: z.string().min(1).max(200).describe('제목'),
            description: z.string().max(1000).optional().describe('설명'),
            priority: z.number().int().min(1).max(5).default(3).describe('우선순위'),
            due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('마감일'),
            project_id: z.number().int().positive().optional().describe('프로젝트 ID'),
            parent_id: z.number().int().positive().optional().describe('부모 태스크 ID'),
            milestone_id: z.number().int().positive().optional().describe('마일스톤 ID'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const todo = todoService.create(params);
            todoService.logAction({ actionType: 'create', todoId: todo.id, payload: params, success: true });
            const levelLabel = todo.level === 'subtask' ? '서브태스크' : (todo.project_id ? '태스크' : '단독 투두');
            const text = `${levelLabel} 생성: [${todo.id}] "${todo.title}" (P${todo.priority})`;
            return { content: [{ type: 'text', text }] };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : '오류';
            todoService.logAction({ actionType: 'create', todoId: null, payload: params, success: false, errorMessage: msg });
            return { content: [{ type: 'text', text: `투두 생성 실패: ${msg}` }], isError: true };
        }
    });
    // ─── todo_modify ─────────────────────────────────────
    server.registerTool('todo_modify', {
        title: '투두 수정',
        description: `기존 투두를 수정합니다. 변경할 필드만 전달하세요.`,
        inputSchema: {
            id: z.number().int().positive().describe('투두 ID'),
            title: z.string().min(1).max(200).optional().describe('새 제목'),
            description: z.string().max(1000).nullable().optional().describe('새 설명'),
            priority: z.number().int().min(1).max(5).optional().describe('새 우선순위'),
            due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('새 마감일'),
            milestone_id: z.number().int().positive().nullable().optional().describe('마일스톤 연결/해제'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ id, ...data }) => {
        try {
            const todo = todoService.update(id, data);
            todoService.logAction({ actionType: 'modify', todoId: id, payload: { id, ...data }, success: true });
            return { content: [{ type: 'text', text: `투두 [${id}] "${todo.title}" 수정 완료.` }] };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : '오류';
            todoService.logAction({ actionType: 'modify', todoId: id, payload: { id, ...data }, success: false, errorMessage: msg });
            return { content: [{ type: 'text', text: `수정 실패: ${msg}` }], isError: true };
        }
    });
    // ─── todo_delete ─────────────────────────────────────
    server.registerTool('todo_delete', {
        title: '투두 삭제',
        description: '투두를 삭제합니다. 태스크 삭제 시 하위 서브태스크도 함께 삭제됩니다.',
        inputSchema: {
            id: z.number().int().positive().describe('투두 ID'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async ({ id }) => {
        try {
            const todo = todoService.getById(id);
            todoService.delete(id);
            todoService.logAction({ actionType: 'delete', todoId: id, payload: { id }, success: true });
            return { content: [{ type: 'text', text: `투두 [${id}] "${todo.title}" 삭제 완료.` }] };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : '오류';
            todoService.logAction({ actionType: 'delete', todoId: id, payload: { id }, success: false, errorMessage: msg });
            return { content: [{ type: 'text', text: `삭제 실패: ${msg}` }], isError: true };
        }
    });
    // ─── todo_complete ───────────────────────────────────
    server.registerTool('todo_complete', {
        title: '투두 완료/취소',
        description: '투두를 완료 처리하거나 미완료로 되돌립니다.',
        inputSchema: {
            id: z.number().int().positive().describe('투두 ID'),
            undo: z.boolean().default(false).describe('true이면 미완료로 되돌림'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ id, undo }) => {
        try {
            const newStatus = undo ? 'pending' : 'completed';
            const todo = todoService.updateStatus(id, newStatus);
            todoService.logAction({ actionType: 'complete', todoId: id, payload: { id, undo }, success: true });
            const action = undo ? '미완료로 되돌림' : '완료';
            return { content: [{ type: 'text', text: `투두 [${id}] "${todo.title}" ${action}.` }] };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : '오류';
            todoService.logAction({ actionType: 'complete', todoId: id, payload: { id, undo }, success: false, errorMessage: msg });
            return { content: [{ type: 'text', text: `상태 변경 실패: ${msg}` }], isError: true };
        }
    });
    // ─── todo_breakdown: 태스크 쪼개기 ───────────────────
    server.registerTool('todo_breakdown', {
        title: '태스크 쪼개기',
        description: `태스크를 여러 서브태스크로 쪼갭니다. 프로젝트의 태스크를 분석하여 하위 작업을 일괄 생성할 때 사용합니다.

이 도구는 Claude가 분석한 서브태스크 목록을 받아서 일괄 생성합니다.
Claude는 이 도구를 호출하기 전에 사용자의 요청을 분석하여 적절한 서브태스크를 구성해야 합니다.

Args:
  - parent_id (number): 부모 태스크 ID (필수)
  - subtasks (array): 생성할 서브태스크 목록
    - title (string): 제목
    - priority (number): 우선순위 1~5
    - due_date (string): 마감일 (선택)

Returns:
  생성된 서브태스크 목록`,
        inputSchema: {
            parent_id: z.number().int().positive().describe('부모 태스크 ID'),
            subtasks: z.array(z.object({
                title: z.string().min(1).max(200).describe('서브태스크 제목'),
                priority: z.number().int().min(1).max(5).default(3).describe('우선순위'),
                due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('마감일'),
            })).min(1).max(20).describe('서브태스크 목록 (1~20개)'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ parent_id, subtasks }) => {
        try {
            // 부모 태스크 존재 및 레벨 확인
            const parent = todoService.getById(parent_id);
            if (parent.level === 'subtask') {
                return { content: [{ type: 'text', text: '서브태스크 아래에 추가 하위를 만들 수 없습니다 (최대 3단계).' }], isError: true };
            }
            // 서브태스크 일괄 생성
            const created = todoService.createMany(subtasks.map((st) => ({
                title: st.title,
                priority: st.priority,
                due_date: st.due_date,
                parent_id,
                project_id: parent.project_id ?? undefined,
            })));
            // 로그
            todoService.logAction({
                actionType: 'create', todoId: parent_id,
                payload: { parent_id, subtask_count: created.length }, success: true,
            });
            const lines = created.map((t) => `  - [${t.id}] ${t.title} (P${t.priority})`);
            const text = `태스크 [${parent_id}] "${parent.title}" 아래에 ${created.length}개 서브태스크 생성:\n\n${lines.join('\n')}`;
            return { content: [{ type: 'text', text }] };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : '오류';
            todoService.logAction({ actionType: 'create', todoId: parent_id, payload: { parent_id }, success: false, errorMessage: msg });
            return { content: [{ type: 'text', text: `태스크 쪼개기 실패: ${msg}` }], isError: true };
        }
    });
}
// ─── 유틸리티 ──────────────────────────────────────────
/** 투두 한 줄 포맷 */
function formatTodo(t) {
    const check = t.status === 'completed' ? '[x]' : '[ ]';
    const due = t.due_date ? ` (마감: ${t.due_date})` : '';
    const proj = t.project_id ? ` [P:${t.project_id}]` : '';
    return `- ${check} **[${t.id}]** ${t.title} — P${t.priority}${due}${proj}`;
}
//# sourceMappingURL=todoTools.js.map