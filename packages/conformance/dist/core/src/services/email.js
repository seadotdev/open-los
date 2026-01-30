import { eq } from "drizzle-orm";
import { deals, documents, communications } from "../schema/tables.js";
import { simpleParser } from "mailparser";
function extractAddress(addressObj) {
    if (!addressObj)
        return null;
    const addrs = Array.isArray(addressObj) ? addressObj : [addressObj];
    for (const addr of addrs) {
        if (addr.value && addr.value.length > 0) {
            return addr.value[0].address ?? null;
        }
    }
    return null;
}
function extractAddresses(addressObj) {
    if (!addressObj)
        return [];
    const addrs = Array.isArray(addressObj) ? addressObj : [addressObj];
    const result = [];
    for (const addr of addrs) {
        if (addr.value) {
            for (const v of addr.value) {
                if (v.address) {
                    result.push(v.address);
                }
            }
        }
    }
    return result;
}
export class EmailService {
    db;
    audit;
    getNow;
    constructor(db, audit, getNow) {
        this.db = db;
        this.audit = audit;
        this.getNow = getNow;
    }
    async ingest(input, rawEml, actor) {
        const now = this.getNow();
        let emlContent;
        if (rawEml) {
            emlContent = rawEml;
        }
        else if (input.raw_rfc822_base64) {
            emlContent = Buffer.from(input.raw_rfc822_base64, "base64");
        }
        else {
            throw new Error("Either file or raw_rfc822_base64 must be provided");
        }
        // Parse the email
        const parsed = await simpleParser(emlContent);
        // Extract headers
        let subject = parsed.subject ?? null;
        if (input.subject_override) {
            subject = input.subject_override;
        }
        const fromAddress = extractAddress(parsed.from);
        const toAddresses = extractAddresses(parsed.to);
        // Message-ID / threading (mailparser can return false, which we treat as null)
        const messageId = typeof parsed.messageId === "string" ? parsed.messageId : null;
        const inReplyTo = typeof parsed.inReplyTo === "string" ? parsed.inReplyTo : null;
        // Thread ID: use In-Reply-To if available (for replies), otherwise use Message-ID
        // This groups replies with the original message
        let threadId = null;
        if (inReplyTo) {
            // This is a reply - use the original message's ID as thread ID
            threadId = inReplyTo;
        }
        else if (messageId) {
            // This is an original message - use its own Message-ID as thread ID
            threadId = messageId;
        }
        // Extract body (text/plain preferred, mailparser can return false)
        const textBody = typeof parsed.text === "string" ? parsed.text : null;
        const htmlBody = typeof parsed.html === "string" ? parsed.html : null;
        const body = textBody ?? htmlBody;
        // Determine deal_id
        let dealId = input.deal_id ?? null;
        // Auto-linking if deal_id not provided
        if (!dealId && subject) {
            dealId = await this.autoLinkDeal(subject);
        }
        // Process attachments
        const attachmentInfos = [];
        if (dealId && parsed.attachments && parsed.attachments.length > 0) {
            for (const attachment of parsed.attachments) {
                const docInfo = await this.storeAttachment(dealId, attachment, actor, now);
                attachmentInfos.push(docInfo);
            }
        }
        // Create communication record
        const commId = crypto.randomUUID();
        await this.db.insert(communications).values({
            id: commId,
            deal_id: dealId,
            type: "email",
            subject,
            from_address: fromAddress,
            to_addresses: toAddresses,
            body,
            thread_id: threadId,
            attachments: attachmentInfos.map((a) => a.document_id),
            created_at: now,
        });
        // Record audit event only if linked to a deal
        if (dealId) {
            await this.audit.record({
                deal_id: dealId,
                type: "EMAIL_INGESTED",
                actor,
                timestamp: now,
                object_type: "communication",
                object_id: commId,
                metadata: {
                    communication_id: commId,
                    subject,
                    from: fromAddress,
                    attachment_count: attachmentInfos.length,
                },
            });
        }
        return {
            communication_id: commId,
            deal_id: dealId,
            type: "email",
            subject,
            from: fromAddress,
            thread_id: threadId,
            attachments: attachmentInfos,
        };
    }
    async autoLinkDeal(subject) {
        // Look for [DEAL-XXXXX] pattern in subject line
        const dealRefMatch = subject.match(/\[DEAL-([^\]]+)\]/i);
        if (!dealRefMatch)
            return null;
        const dealRef = dealRefMatch[1];
        // Try to find a deal by short_id prefix match or full ID
        const allDeals = await this.db.select().from(deals);
        for (const deal of allDeals) {
            // Check if deal ID starts with the reference
            if (deal.id.startsWith(dealRef)) {
                return deal.id;
            }
            // Check if first 8 chars of deal ID match (common short ID format)
            if (deal.id.slice(0, 8).toUpperCase() === dealRef.toUpperCase()) {
                return deal.id;
            }
        }
        return null;
    }
    async storeAttachment(dealId, attachment, actor, now) {
        const docId = crypto.randomUUID();
        const filename = attachment.filename ?? "attachment";
        const mimeType = attachment.contentType ?? "application/octet-stream";
        const content = attachment.content;
        await this.db.insert(documents).values({
            id: docId,
            deal_id: dealId,
            doc_type: "email_attachment",
            phase: null,
            filename,
            label: null,
            mime_type: mimeType,
            size_bytes: content.length,
            checksum: null,
            content,
            version: 1,
            source: "email_attachment",
            created_at: now,
            created_by: actor,
        });
        await this.audit.record({
            deal_id: dealId,
            type: "DOCUMENT_UPLOADED",
            actor,
            timestamp: now,
            object_type: "document",
            object_id: docId,
            metadata: {
                doc_type: "email_attachment",
                filename,
                source: "email_attachment",
            },
        });
        return {
            document_id: docId,
            filename,
        };
    }
    async listByDeal(dealId) {
        const rows = await this.db
            .select()
            .from(communications)
            .where(eq(communications.deal_id, dealId));
        return {
            communications: rows.map((row) => ({
                id: row.id,
                deal_id: row.deal_id,
                type: row.type,
                subject: row.subject,
                from: row.from_address,
                to: row.to_addresses,
                body: row.body,
                thread_id: row.thread_id,
                attachments: row.attachments ?? [],
                created_at: row.created_at,
            })),
        };
    }
}
//# sourceMappingURL=email.js.map