import type { Database as SqlJsDatabase } from 'sql.js';
export declare class DbWrapper {
    private _db;
    private _filePath;
    constructor(sqlDb: SqlJsDatabase, filePath?: string | null);
    exec(sql: string): void;
    pragma(pragma: string): void;
    prepare(sql: string): {
        get(...params: unknown[]): Record<string, unknown> | undefined;
        all(...params: unknown[]): Record<string, unknown>[];
        run(...params: unknown[]): {
            changes: number;
            lastInsertRowid: number;
        };
    };
    close(): void;
    private _save;
}
export declare function getDb(dbPath?: string): Promise<DbWrapper>;
export declare function closeDb(): void;
export declare function createTestDb(): Promise<DbWrapper>;
//# sourceMappingURL=init.d.ts.map