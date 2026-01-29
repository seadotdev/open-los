import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
export interface UploadDocumentInput {
    doc_type: string;
    filename: string;
    phase?: string;
    label?: string;
    content_base64?: string;
}
export declare class DocumentService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    upload(dealId: string, input: UploadDocumentInput, actor: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        deal_id: string;
        doc_type: string;
        phase: string | null;
        filename: string;
        label: string | null;
        mime_type: null;
        size_bytes: number | null;
        checksum: null;
        version: number;
        source: null;
        created_at: string;
        created_by: string;
    }>;
    listByDeal(dealId: string): Promise<{
        id: string;
        deal_id: string;
        doc_type: string;
        phase: string | null;
        filename: string;
        label: string | null;
        mime_type: string | null;
        size_bytes: number | null;
        checksum: string | null;
        version: number;
        source: string | null;
        created_at: string;
        created_by: string | null;
    }[]>;
}
//# sourceMappingURL=document.d.ts.map