// src/services/todoService.ts
// 투두 CRUD — 3단계 계층 (프로젝트 → 태스크 → 서브태스크)
import { ServiceError } from './projectService.js';
export class TodoService {
    db;
    constructor(db) {
        this.db = db;
    }
    /** 투두 목록 조회 (다양한 필터) */
    getAll(options = {}) {
        let query = 'SELECT * FROM todos WHERE 1=1';
        const params = [];
        // 상태 필터
        if (options.status) {
            query += ' AND status = ?';
            params.push(options.status);
        }
        // 프로젝트 필터
        if (options.project_id !== undefined) {
            query += ' AND project_id = ?';
            params.push(options.project_id);
        }
        // 부모 필터 (null = 최상위 태스크, 숫자 = 특정 부모의 서브태스크)
        if (options.parent_id === null) {
            query += ' AND parent_id IS NULL';
        }
        else if (options.parent_id !== undefined) {
            query += ' AND parent_id = ?';
            params.push(options.parent_id);
        }
        // 레벨 필터
        if (options.level) {
            query += ' AND level = ?';
            params.push(options.level);
        }
        query += ' ORDER BY priority ASC, due_date ASC';
        const todos = this.db.prepare(query).all(...params);
        return { todos, totalCount: todos.length };
    }
    /** 단독 투두 목록 (프로젝트 미소속) */
    getStandalone(options = {}) {
        let query = 'SELECT * FROM todos WHERE project_id IS NULL AND parent_id IS NULL';
        const params = [];
        if (options.status) {
            query += ' AND status = ?';
            params.push(options.status);
        }
        query += ' ORDER BY priority ASC, due_date ASC';
        const todos = this.db.prepare(query).all(...params);
        return { todos, totalCount: todos.length };
    }
    /** 프로젝트의 태스크 + 서브태스크 (트리 구조) */
    getProjectTree(projectId) {
        // 1. 최상위 태스크 조회
        const tasks = this.db.prepare('SELECT * FROM todos WHERE project_id = ? AND parent_id IS NULL ORDER BY priority ASC, due_date ASC').all(projectId);
        // 2. 각 태스크의 서브태스크 부착
        return tasks.map((task) => {
            const subtasks = this.db.prepare('SELECT * FROM todos WHERE parent_id = ? ORDER BY priority ASC, due_date ASC').all(task.id);
            return { ...task, subtasks };
        });
    }
    /** 단일 투두 조회 */
    getById(id) {
        const todo = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
        if (!todo)
            throw new ServiceError(`투두를 찾을 수 없습니다 (ID: ${id})`, 404, 'TODO_NOT_FOUND');
        return todo;
    }
    /** 투두 생성 — 계층 자동 결정 */
    create(data) {
        const { title, description = null, priority = 3, due_date = null, project_id = null, parent_id = null, milestone_id = null } = data;
        // parent_id가 있으면 서브태스크, 없으면 태스크
        const level = parent_id ? 'subtask' : 'task';
        // parent_id가 있으면 부모의 project_id를 상속
        let resolvedProjectId = project_id;
        if (parent_id) {
            const parent = this.getById(parent_id);
            // 서브태스크는 태스크 아래만 가능 (3단계 제한)
            if (parent.level === 'subtask') {
                throw new ServiceError('서브태스크 아래에 추가 하위 태스크를 만들 수 없습니다 (최대 3단계)', 400, 'MAX_DEPTH_EXCEEDED');
            }
            resolvedProjectId = parent.project_id;
        }
        const result = this.db.prepare('INSERT INTO todos (title, description, priority, due_date, project_id, parent_id, milestone_id, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(title, description, priority, due_date, resolvedProjectId, parent_id, milestone_id, level);
        return this.getById(result.lastInsertRowid);
    }
    /** 여러 투두 일괄 생성 (태스크 쪼개기용) */
    createMany(items) {
        return items.map((item) => this.create(item));
    }
    /** 투두 수정 */
    update(id, data) {
        this.getById(id); // 존재 확인
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        fields.push('updated_at = CURRENT_TIMESTAMP');
        this.db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
        return this.getById(id);
    }
    /** 투두 삭제 (서브태스크도 CASCADE 삭제) */
    delete(id) {
        this.getById(id); // 존재 확인
        this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
        return { success: true, id };
    }
    /** 투두 상태 변경 */
    updateStatus(id, status) {
        return this.update(id, { status });
    }
    /** 도구 액션 기록 */
    logAction(action) {
        this.db.prepare('INSERT INTO tool_actions (action_type, todo_id, payload, success, error_message) VALUES (?, ?, ?, ?, ?)').run(action.actionType, action.todoId, JSON.stringify(action.payload), action.success ? 1 : 0, action.errorMessage || null);
    }
}
//# sourceMappingURL=todoService.js.map