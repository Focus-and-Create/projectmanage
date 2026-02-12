// __tests__/unit/services.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, type DbWrapper } from '../../src/db/init.js';
import { TodoService } from '../../src/services/todoService.js';
import { ProjectService } from '../../src/services/projectService.js';

describe('ProjectService', () => {
  let db: DbWrapper;
  let projectService: ProjectService;
  let todoService: TodoService;

  beforeEach(async () => {
    db = await createTestDb();
    projectService = new ProjectService(db);
    todoService = new TodoService(db);
  });
  afterEach(() => db.close());

  describe('CRUD', () => {
    it('프로젝트를 생성한다', () => {
      const p = projectService.create({ name: '포트폴리오 리뉴얼', description: '웹사이트 개편' });
      expect(p.id).toBe(1);
      expect(p.name).toBe('포트폴리오 리뉴얼');
      expect(p.status).toBe('active');
      expect(p.progress_percent).toBe(0);
    });

    it('프로젝트 목록을 조회한다', () => {
      projectService.create({ name: 'A' });
      projectService.create({ name: 'B' });
      const all = projectService.getAll();
      expect(all).toHaveLength(2);
    });

    it('상태별 필터링', () => {
      const p = projectService.create({ name: 'A' });
      projectService.update(p.id, { status: 'completed' });
      projectService.create({ name: 'B' });
      expect(projectService.getAll({ status: 'active' })).toHaveLength(1);
      expect(projectService.getAll({ status: 'completed' })).toHaveLength(1);
    });

    it('존재하지 않는 ID 조회 시 에러', () => {
      expect(() => projectService.getById(999)).toThrow('찾을 수 없습니다');
    });

    it('프로젝트를 수정한다', () => {
      const p = projectService.create({ name: '원래' });
      const u = projectService.update(p.id, { name: '수정됨', status: 'on_hold' });
      expect(u.name).toBe('수정됨');
      expect(u.status).toBe('on_hold');
    });
  });

  describe('진행률', () => {
    it('태스크 없으면 0%', () => {
      const p = projectService.create({ name: 'A' });
      expect(p.progress_percent).toBe(0);
    });

    it('태스크 완료율 계산', () => {
      const p = projectService.create({ name: 'A' });
      const t1 = todoService.create({ title: '1', project_id: p.id });
      todoService.create({ title: '2', project_id: p.id });
      todoService.create({ title: '3', project_id: p.id });
      todoService.updateStatus(t1.id, 'completed');

      const updated = projectService.getById(p.id);
      expect(updated.total_tasks).toBe(3);
      expect(updated.completed_tasks).toBe(1);
      expect(updated.progress_percent).toBe(33);    // 1/3 = 33%
    });

    it('서브태스크도 진행률에 포함', () => {
      const p = projectService.create({ name: 'A' });
      const task = todoService.create({ title: '태스크', project_id: p.id });
      const sub = todoService.create({ title: '서브', parent_id: task.id });
      todoService.updateStatus(sub.id, 'completed');

      const updated = projectService.getById(p.id);
      expect(updated.total_tasks).toBe(2);          // 태스크 + 서브태스크
      expect(updated.completed_tasks).toBe(1);
      expect(updated.progress_percent).toBe(50);
    });
  });

  describe('마일스톤', () => {
    it('마일스톤을 생성한다', () => {
      const p = projectService.create({ name: 'A' });
      const m = projectService.createMilestone({ project_id: p.id, title: '1차 릴리스', target_date: '2026-03-01' });
      expect(m.id).toBe(1);
      expect(m.title).toBe('1차 릴리스');
      expect(m.status).toBe('pending');
    });

    it('마일스톤 완료 처리', () => {
      const p = projectService.create({ name: 'A' });
      const m = projectService.createMilestone({ project_id: p.id, title: 'M1', target_date: '2026-03-01' });
      const completed = projectService.completeMilestone(m.id);
      expect(completed.status).toBe('reached');
    });

    it('마일스톤 진행률 계산', () => {
      const p = projectService.create({ name: 'A' });
      const m = projectService.createMilestone({ project_id: p.id, title: 'M1', target_date: '2026-03-01' });
      const t1 = todoService.create({ title: '1', project_id: p.id, milestone_id: m.id });
      todoService.create({ title: '2', project_id: p.id, milestone_id: m.id });
      todoService.updateStatus(t1.id, 'completed');

      const milestones = projectService.getMilestones(p.id);
      expect(milestones[0].progress_percent).toBe(50);
    });
  });
});

describe('TodoService (계층)', () => {
  let db: DbWrapper;
  let todoService: TodoService;
  let projectService: ProjectService;

  beforeEach(async () => {
    db = await createTestDb();
    todoService = new TodoService(db);
    projectService = new ProjectService(db);
  });
  afterEach(() => db.close());

  describe('단독 투두', () => {
    it('프로젝트 없이 단독 투두 생성', () => {
      const t = todoService.create({ title: '장보기' });
      expect(t.project_id).toBeNull();
      expect(t.parent_id).toBeNull();
      expect(t.level).toBe('task');
    });

    it('단독 투두만 조회', () => {
      const p = projectService.create({ name: 'P' });
      todoService.create({ title: '단독' });
      todoService.create({ title: '프로젝트 소속', project_id: p.id });
      const standalone = todoService.getStandalone();
      expect(standalone.totalCount).toBe(1);
      expect(standalone.todos[0].title).toBe('단독');
    });
  });

  describe('3단계 계층', () => {
    it('프로젝트 → 태스크 생성', () => {
      const p = projectService.create({ name: 'P' });
      const t = todoService.create({ title: '디자인', project_id: p.id });
      expect(t.project_id).toBe(p.id);
      expect(t.level).toBe('task');
    });

    it('태스크 → 서브태스크 생성', () => {
      const p = projectService.create({ name: 'P' });
      const task = todoService.create({ title: '디자인', project_id: p.id });
      const sub = todoService.create({ title: '와이어프레임', parent_id: task.id });
      expect(sub.level).toBe('subtask');
      expect(sub.parent_id).toBe(task.id);
      expect(sub.project_id).toBe(p.id);     // 부모의 project_id 상속
    });

    it('서브태스크 아래에 추가 하위를 만들면 에러 (3단계 제한)', () => {
      const p = projectService.create({ name: 'P' });
      const task = todoService.create({ title: '태스크', project_id: p.id });
      const sub = todoService.create({ title: '서브', parent_id: task.id });
      expect(() => todoService.create({ title: '서브서브', parent_id: sub.id })).toThrow('최대 3단계');
    });

    it('프로젝트 트리 조회', () => {
      const p = projectService.create({ name: 'P' });
      const t1 = todoService.create({ title: '태스크1', project_id: p.id });
      const t2 = todoService.create({ title: '태스크2', project_id: p.id });
      todoService.create({ title: '서브1-1', parent_id: t1.id });
      todoService.create({ title: '서브1-2', parent_id: t1.id });
      todoService.create({ title: '서브2-1', parent_id: t2.id });

      const tree = todoService.getProjectTree(p.id);
      expect(tree).toHaveLength(2);                // 태스크 2개
      expect(tree[0].subtasks).toHaveLength(2);    // 태스크1의 서브태스크 2개
      expect(tree[1].subtasks).toHaveLength(1);    // 태스크2의 서브태스크 1개
    });
  });

  describe('태스크 쪼개기 (createMany)', () => {
    it('여러 서브태스크를 일괄 생성한다', () => {
      const p = projectService.create({ name: 'P' });
      const task = todoService.create({ title: '디자인', project_id: p.id });

      const subs = todoService.createMany([
        { title: '와이어프레임', parent_id: task.id },
        { title: '시안 제작', parent_id: task.id, priority: 1 },
        { title: '피드백 반영', parent_id: task.id, due_date: '2026-03-01' },
      ]);

      expect(subs).toHaveLength(3);
      expect(subs.every((s) => s.level === 'subtask')).toBe(true);
      expect(subs.every((s) => s.project_id === p.id)).toBe(true);
    });
  });

  describe('CASCADE 삭제', () => {
    it('태스크 삭제 시 서브태스크도 삭제된다', () => {
      const p = projectService.create({ name: 'P' });
      const task = todoService.create({ title: '태스크', project_id: p.id });
      todoService.create({ title: '서브1', parent_id: task.id });
      todoService.create({ title: '서브2', parent_id: task.id });

      todoService.delete(task.id);
      const all = todoService.getAll({ project_id: p.id });
      expect(all.totalCount).toBe(0);              // 전부 삭제됨
    });
  });
});
