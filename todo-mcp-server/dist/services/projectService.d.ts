import type { DbWrapper } from '../db/init.js';
import type { ProjectWithProgress, ProjectCreateInput, ProjectUpdateInput, MilestoneCreateInput, MilestoneWithProgress } from '../types.js';
/** 커스텀 에러 */
export declare class ServiceError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
export declare class ProjectService {
    private db;
    constructor(db: DbWrapper);
    /** 전체 프로젝트 목록 + 진행률 */
    getAll(options?: {
        status?: string;
    }): ProjectWithProgress[];
    /** 단일 프로젝트 조회 + 진행률 */
    getById(id: number): ProjectWithProgress;
    /** 프로젝트 생성 */
    create(data: ProjectCreateInput): ProjectWithProgress;
    /** 프로젝트 수정 */
    update(id: number, data: ProjectUpdateInput): ProjectWithProgress;
    /** 프로젝트 삭제 */
    delete(id: number): {
        success: true;
        id: number;
    };
    /** 프로젝트에 진행률 정보 부착 */
    private attachProgress;
    /** 프로젝트의 마일스톤 목록 + 진행률 */
    getMilestones(projectId: number): MilestoneWithProgress[];
    /** 마일스톤 조회 */
    getMilestoneById(id: number): MilestoneWithProgress;
    /** 마일스톤 생성 */
    createMilestone(data: MilestoneCreateInput): MilestoneWithProgress;
    /** 마일스톤 완료 처리 */
    completeMilestone(id: number, undo?: boolean): MilestoneWithProgress;
    /** 마일스톤 삭제 */
    deleteMilestone(id: number): {
        success: true;
        id: number;
    };
    /** 마일스톤에 진행률 부착 */
    private attachMilestoneProgress;
}
//# sourceMappingURL=projectService.d.ts.map