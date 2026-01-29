import * as schema from "./tables.js";
export type Database = ReturnType<typeof createDatabase>;
export declare function createDatabase(url?: string): import("drizzle-orm/libsql").LibSQLDatabase<typeof schema> & {
    $client: import("@libsql/client").Client;
};
export declare function migrateDatabase(db: Database): Promise<void>;
export { schema };
//# sourceMappingURL=db.d.ts.map