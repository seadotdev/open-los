import { describe, it, expect } from "vitest";
import { createAppWithDb } from "@open-los/api";
import { eq, and } from "drizzle-orm";
import { entities } from "@open-los/core";
describe("Debug entity list filtering", () => {
    it("filters entities by type correctly with direct DB query", async () => {
        const { ctx } = await createAppWithDb(() => "2026-01-15T10:00:00Z");
        // Create 2 companies and 2 persons
        await ctx.entityService.create({ type: "company", name: "Co1" }, "test");
        await ctx.entityService.create({ type: "company", name: "Co2" }, "test");
        await ctx.entityService.create({ type: "person", name: "P1" }, "test");
        await ctx.entityService.create({ type: "person", name: "P2" }, "test");
        // Direct DB query to check
        const allEntities = await ctx.db.select().from(entities);
        console.log("All DB entities:", allEntities.map(e => `${e.name}:${e.type}:${e.tenant_id}`));
        // Direct filtered query
        const companiesDirectly = await ctx.db
            .select()
            .from(entities)
            .where(and(eq(entities.tenant_id, "default"), eq(entities.type, "company")));
        console.log("Direct company query:", companiesDirectly.length, companiesDirectly.map(e => `${e.name}:${e.type}`));
        // List via service
        const companies = await ctx.entityService.list("default", { type: "company" });
        console.log("Service companies:", companies.entities.length, companies.entities.map(e => `${e.name}:${e.type}`));
        expect(companiesDirectly.length).toBe(2);
        expect(companies.entities.length).toBe(2);
    });
});
//# sourceMappingURL=debug.test.js.map