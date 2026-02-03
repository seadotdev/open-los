import { eq, and } from "drizzle-orm";
import type { Database } from "../schema/db.js";
import { deals, documents } from "../schema/tables.js";
import type { AuditService } from "./audit.js";
import { NotFoundError, ValidationError } from "./errors.js";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface UploadDocumentInput {
  doc_type: string;
  filename: string;
  phase?: string;
  label?: string;
  content_base64?: string;
}

export class DocumentService {
  constructor(
    private db: Database,
    private audit: AuditService,
    private getNow: () => string
  ) {}

  async upload(
    dealId: string,
    input: UploadDocumentInput,
    actor: string,
    tenantId = "default"
  ) {
    await this.ensureDealAccess(dealId, tenantId);

    if (!input.doc_type || input.doc_type.trim() === "") {
      throw new ValidationError("doc_type is required");
    }
    if (!input.filename || input.filename.trim() === "") {
      throw new ValidationError("filename is required");
    }

    const contentBase64 = input.content_base64?.trim();
    if (contentBase64 === "") {
      throw new ValidationError("content_base64 cannot be empty when provided");
    }

    if (contentBase64 && !/^[A-Za-z0-9+/=]+$/.test(contentBase64)) {
      throw new ValidationError("content_base64 must be base64-encoded");
    }

    const estimatedBytes = contentBase64 ? Math.floor((contentBase64.length * 3) / 4) : 0;
    if (estimatedBytes > MAX_DOCUMENT_BYTES) {
      throw new ValidationError("document exceeds maximum allowed size", {
        max_bytes: MAX_DOCUMENT_BYTES,
      });
    }

    const id = crypto.randomUUID();
    const now = this.getNow();

    const content = contentBase64 ? Buffer.from(contentBase64, "base64") : null;
    if (content && content.length > MAX_DOCUMENT_BYTES) {
      throw new ValidationError("document exceeds maximum allowed size", {
        max_bytes: MAX_DOCUMENT_BYTES,
      });
    }

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

  async listByDeal(dealId: string, tenantId = "default") {
    await this.ensureDealAccess(dealId, tenantId);
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

  private async ensureDealAccess(dealId: string, tenantId: string) {
    const rows = await this.db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.tenant_id, tenantId)));
    if (rows.length === 0) {
      throw new NotFoundError(`Deal ${dealId} not found`);
    }
  }
}
