// src/services/projectService.ts
// 프로젝트 CRUD + 진행률 계산
/** 커스텀 에러 */
export class ServiceError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ServiceError';
    }
}
export class ProjectService {
    db;
    constructor(db) {
        this.db = db;
    }
    // ─── 프로젝트 CRUD ────────────────────────────────────
    /** 전체 프로젝트 목록 + 진행률 */
    getAll(options = {}) {
        let query = 'SELECT * FROM projects';
        const params = [];
        if (options.status) {
            query += ' WHERE status = ?';
            params.push(options.status);
        }
        query += ' ORDER BY id DESC';
        const projects = this.db.prepare(query).all(...params);
        return projects.map((p) => this.attachProgress(p));
    }
    /** 단일 프로젝트 조회 + 진행률 */
    getById(id) {
        const project = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        if (!project)
            throw new ServiceError(`프로젝트를 찾을 수 없습니다 (ID: ${id})`, 404, 'PROJECT_NOT_FOUND');
        return this.attachProgress(project);
    }
    /** 프로젝트 생성 */
    create(data) {
        const { name, description = null } = data;
        const result = this.db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name, description);
        return this.getById(result.lastInsertRowid);
    }
    /** 프로젝트 수정 */
    update(id, data) {
        this.getById(id); // 존재 확인
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        fields.push('updated_at = CURRENT_TIMESTAMP');
        this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
        return this.getById(id);
    }
    /** 프로젝트 삭제 */
    delete(id) {
        this.getById(id); // 존재 확인
        this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        return { success: true, id };
    }
    /** 프로젝트에 진행률 정보 부착 */
    attachProgress(project) {
        // 해당 프로젝트의 모든 투두 (태스크 + 서브태스크)
        const total = this.db.prepare('SELECT COUNT(*) as cnt FROM todos WHERE project_id = ?').get(project.id);
        const completed = this.db.prepare('SELECT COUNT(*) as cnt FROM todos WHERE project_id = ? AND status = ?').get(project.id, 'completed');
        const totalCount = Number(total?.cnt || 0);
        const completedCount = Number(completed?.cnt || 0);
        return {
            ...project,
            total_tasks: totalCount,
            completed_tasks: completedCount,
            progress_percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        };
    }
    // ─── 마일스톤 CRUD ────────────────────────────────────
    /** 프로젝트의 마일스톤 목록 + 진행률 */
    getMilestones(projectId) {
        this.getById(projectId); // 프로젝트 존재 확인
        const milestones = this.db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY target_date ASC').all(projectId);
        return milestones.map((m) => this.attachMilestoneProgress(m));
    }
    /** 마일스톤 조회 */
    getMilestoneById(id) {
        const m = this.db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
        if (!m)
            throw new ServiceError(`마일스톤을 찾을 수 없습니다 (ID: ${id})`, 404, 'MILESTONE_NOT_FOUND');
        return this.attachMilestoneProgress(m);
    }
    /** 마일스톤 생성 */
    createMilestone(data) {
        this.getById(data.project_id); // 프로젝트 존재 확인
        const result = this.db.prepare('INSERT INTO milestones (project_id, title, target_date) VALUES (?, ?, ?)').run(data.project_id, data.title, data.target_date);
        return this.getMilestoneById(result.lastInsertRowid);
    }
    /** 마일스톤 완료 처리 */
    completeMilestone(id, undo = false) {
        this.getMilestoneById(id); // 존재 확인
        const newStatus = undo ? 'pending' : 'reached';
        this.db.prepare('UPDATE milestones SET status = ? WHERE id = ?').run(newStatus, id);
        return this.getMilestoneById(id);
    }
    /** 마일스톤 삭제 */
    deleteMilestone(id) {
        this.getMilestoneById(id); // 존재 확인
        this.db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
        return { success: true, id };
    }
    /** 마일스톤에 진행률 부착 */
    attachMilestoneProgress(milestone) {
        const total = this.db.prepare('SELECT COUNT(*) as cnt FROM todos WHERE milestone_id = ?').get(milestone.id);
        const completed = this.db.prepare('SELECT COUNT(*) as cnt FROM todos WHERE milestone_id = ? AND status = ?').get(milestone.id, 'completed');
        const totalCount = Number(total?.cnt || 0);
        const completedCount = Number(completed?.cnt || 0);
        return {
            ...milestone,
            total_tasks: totalCount,
            completed_tasks: completedCount,
            progress_percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        };
    }
}
//# sourceMappingURL=projectService.js.map