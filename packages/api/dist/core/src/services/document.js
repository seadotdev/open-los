import { eq } from "drizzle-orm";
import { documents } from "../schema/tables.js";
export class DocumentService {
    db;
    audit;
    getNow;
    constructor(db, audit, getNow) {
        this.db = db;
        this.audit = audit;
        this.getNow = getNow;
    }
    async upload(dealId, input, actor) {
        const id = crypto.randomUUID();
        const now = this.getNow();
        const content = input.content_base64
            ? Buffer.from(input.content_base64, "base64")
            : null;
        const doc = {
            id,
            deal_id: dealId,
            doc_type: input.doc_type,
            phase: input.phase ?? null,
            filename: input.filename,
            label: input.label ?? null,
            mime_type: null,
            size_bytes: content?.length ?? null,
            checksum: null,
            content,
            version: 1,
            source: null,
            created_at: now,
            created_by: actor,
        };
        await this.db.insert(documents).values(doc);
        await this.audit.record({
            deal_id: dealId,
            type: "DOCUMENT_UPLOADED",
            actor,
            timestamp: now,
            object_type: "document",
            object_id: id,
            metadata: { doc_type: input.doc_type, filename: input.filename },
        });
        // Return without content blob
        const { content: _content, ...docWithoutContent } = doc;
        return docWithoutContent;
    }
    async listByDeal(dealId) {
        const rows = await this.db
            .select({
            id: documents.id,
            deal_id: documents.deal_id,
            doc_type: documents.doc_type,
            phase: documents.phase,
            filename: documents.filename,
            label: documents.label,
            mime_type: documents.mime_type,
            size_bytes: documents.size_bytes,
            checksum: documents.checksum,
            version: documents.version,
            source: documents.source,
            created_at: documents.created_at,
            created_by: documents.created_by,
        })
            .from(documents)
            .where(eq(documents.deal_id, dealId));
        return rows;
    }
}
//# sourceMappingURL=document.js.map