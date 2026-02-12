// src/db/init.ts
// SQLite DB 초기화 — 프로젝트 + 마일스톤 + 3단계 투두 계층
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
let SQL = null;
// ─── DbWrapper ─────────────────────────────────────────
export class DbWrapper {
    _db;
    _filePath;
    constructor(sqlDb, filePath = null) {
        this._db = sqlDb;
        this._filePath = filePath;
    }
    exec(sql) {
        this._db.run(sql);
        this._save();
    }
    pragma(pragma) {
        try {
            this._db.run(`PRAGMA ${pragma}`);
        }
        catch { /* 미지원 무시 */ }
    }
    prepare(sql) {
        const self = this;
        return {
            get(...params) {
                const stmt = self._db.prepare(sql);
                if (params.length > 0)
                    stmt.bind(params);
                if (stmt.step()) {
                    const r = stmt.getAsObject();
                    stmt.free();
                    return r;
                }
                stmt.free();
                return undefined;
            },
            all(...params) {
                const results = [];
                const stmt = self._db.prepare(sql);
                if (params.length > 0)
                    stmt.bind(params);
                while (stmt.step())
                    results.push(stmt.getAsObject());
                stmt.free();
                return results;
            },
            run(...params) {
                const stmt = self._db.prepare(sql);
                if (params.length > 0)
                    stmt.bind(params);
                stmt.step();
                stmt.free();
                const changes = self._db.getRowsModified();
                const ls = self._db.prepare('SELECT last_insert_rowid() as id');
                ls.step();
                const lastId = ls.getAsObject().id;
                ls.free();
                self._save();
                return { changes, lastInsertRowid: lastId };
            },
        };
    }
    close() { this._save(); this._db.close(); }
    _save() {
        if (this._filePath)
            writeFileSync(this._filePath, Buffer.from(this._db.export()));
    }
}
// ─── 테이블 초기화 ─────────────────────────────────────
function initTables(db) {
    // 프로젝트 테이블
    db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'on_hold', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // 마일스톤 테이블
    db.exec(`
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      target_date DATE NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reached')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // 투두 테이블 — 3단계 계층 (project → task → subtask)
    db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
      due_date DATE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      parent_id INTEGER REFERENCES todos(id) ON DELETE CASCADE,
      milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
      level TEXT DEFAULT 'task' CHECK (level IN ('task', 'subtask')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // 도구 액션 기록
    db.exec(`
    CREATE TABLE IF NOT EXISTS tool_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      todo_id INTEGER,
      payload TEXT,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // 인덱스
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(project_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_milestone ON todos(milestone_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_tool_actions_todo ON tool_actions(todo_id)');
}
// ─── DB 팩토리 ─────────────────────────────────────────
async function getSqlJs() {
    if (!SQL)
        SQL = await initSqlJs();
    return SQL;
}
let db = null;
export async function getDb(dbPath) {
    if (db)
        return db;
    const p = dbPath || process.env.DB_PATH || './data/todos.db';
    const S = await getSqlJs();
    let sqlDb;
    if (p === ':memory:') {
        sqlDb = new S.Database();
    }
    else {
        const dir = dirname(p);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        sqlDb = existsSync(p) ? new S.Database(readFileSync(p)) : new S.Database();
    }
    db = new DbWrapper(sqlDb, p === ':memory:' ? null : p);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables(db);
    return db;
}
export function closeDb() { if (db) {
    db.close();
    db = null;
} }
export async function createTestDb() {
    const S = await getSqlJs();
    const w = new DbWrapper(new S.Database(), null);
    w.pragma('foreign_keys = ON');
    initTables(w);
    return w;
}
//# sourceMappingURL=init.js.map