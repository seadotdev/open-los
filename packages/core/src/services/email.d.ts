import type { Database } from "../schema/db.js";
import type { AuditService } from "./audit.js";
export interface EmailIngestInput {
    deal_id?: string;
    raw_rfc822_base64?: string;
    subject_override?: string;
}
export interface AttachmentInfo {
    document_id: string;
    filename: string;
}
export interface EmailIngestResult {
    communication_id: string;
    deal_id: string | null;
    type: "email";
    subject: string | null;
    from: string | null;
    thread_id: string | null;
    attachments: AttachmentInfo[];
}
export interface CommunicationRecord {
    id: string;
    deal_id: string | null;
    type: string;
    subject: string | null;
    from: string | null;
    to: string[] | null;
    body: string | null;
    thread_id: string | null;
    attachments: string[];
    created_at: string;
}
export declare class EmailService {
    private db;
    private audit;
    private getNow;
    constructor(db: Database, audit: AuditService, getNow: () => string);
    ingest(input: EmailIngestInput, rawEml: Buffer | null, actor: string): Promise<EmailIngestResult>;
    private autoLinkDeal;
    private storeAttachment;
    listByDeal(dealId: string): Promise<{
        communications: CommunicationRecord[];
    }>;
}
//# sourceMappingURL=email.d.ts.map