import type { DbWrapper } from '../db/init.js';
import type { Todo, TodoWithChildren, TodoCreateInput, TodoUpdateInput, TodoListResult, ToolAction } from '../types.js';
export declare class TodoService {
    private db;
    constructor(db: DbWrapper);
    /** 투두 목록 조회 (다양한 필터) */
    getAll(options?: {
        status?: string;
        project_id?: number;
        parent_id?: number | null;
        level?: string;
    }): TodoListResult;
    /** 단독 투두 목록 (프로젝트 미소속) */
    getStandalone(options?: {
        status?: string;
    }): TodoListResult;
    /** 프로젝트의 태스크 + 서브태스크 (트리 구조) */
    getProjectTree(projectId: number): TodoWithChildren[];
    /** 단일 투두 조회 */
    getById(id: number): Todo;
    /** 투두 생성 — 계층 자동 결정 */
    create(data: TodoCreateInput): Todo;
    /** 여러 투두 일괄 생성 (태스크 쪼개기용) */
    createMany(items: TodoCreateInput[]): Todo[];
    /** 투두 수정 */
    update(id: number, data: TodoUpdateInput): Todo;
    /** 투두 삭제 (서브태스크도 CASCADE 삭제) */
    delete(id: number): {
        success: true;
        id: number;
    };
    /** 투두 상태 변경 */
    updateStatus(id: number, status: 'pending' | 'completed'): Todo;
    /** 도구 액션 기록 */
    logAction(action: ToolAction): void;
}
//# sourceMappingURL=todoService.d.ts.map