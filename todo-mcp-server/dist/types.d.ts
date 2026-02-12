/** 프로젝트 상태 */
export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'archived';
/** 프로젝트 객체 */
export interface Project {
    id: number;
    name: string;
    description: string | null;
    status: ProjectStatus;
    created_at: string;
    updated_at: string;
}
/** 프로젝트 + 진행률 */
export interface ProjectWithProgress extends Project {
    total_tasks: number;
    completed_tasks: number;
    progress_percent: number;
}
/** 프로젝트 생성 입력 */
export interface ProjectCreateInput {
    name: string;
    description?: string;
}
/** 프로젝트 수정 입력 */
export interface ProjectUpdateInput {
    name?: string;
    description?: string | null;
    status?: ProjectStatus;
}
/** 마일스톤 객체 */
export interface Milestone {
    id: number;
    project_id: number;
    title: string;
    target_date: string;
    status: 'pending' | 'reached';
    created_at: string;
}
/** 마일스톤 + 연결된 태스크 진행률 */
export interface MilestoneWithProgress extends Milestone {
    total_tasks: number;
    completed_tasks: number;
    progress_percent: number;
}
/** 마일스톤 생성 입력 */
export interface MilestoneCreateInput {
    project_id: number;
    title: string;
    target_date: string;
}
/** 투두 상태 */
export type TodoStatus = 'pending' | 'completed';
/** 투두 계층 레벨 */
export type TodoLevel = 'task' | 'subtask';
/** 투두 객체 */
export interface Todo {
    id: number;
    title: string;
    description: string | null;
    status: TodoStatus;
    priority: number;
    due_date: string | null;
    project_id: number | null;
    parent_id: number | null;
    milestone_id: number | null;
    level: TodoLevel;
    created_at: string;
    updated_at: string;
}
/** 태스크 + 서브태스크 포함 */
export interface TodoWithChildren extends Todo {
    subtasks: Todo[];
}
/** 투두 생성 입력 */
export interface TodoCreateInput {
    title: string;
    description?: string;
    priority?: number;
    due_date?: string;
    project_id?: number;
    parent_id?: number;
    milestone_id?: number;
}
/** 투두 수정 입력 */
export interface TodoUpdateInput {
    title?: string;
    description?: string | null;
    status?: TodoStatus;
    priority?: number;
    due_date?: string | null;
    project_id?: number | null;
    parent_id?: number | null;
    milestone_id?: number | null;
}
/** 투두 목록 응답 */
export interface TodoListResult {
    todos: Todo[];
    totalCount: number;
}
/** 도구 실행 기록 */
export interface ToolAction {
    actionType: string;
    todoId: number | null;
    payload: Record<string, unknown>;
    success: boolean;
    errorMessage?: string;
}
//# sourceMappingURL=types.d.ts.map