export interface Template {
    id: string;
    name: string;
    phase: string;
    doc_type: string;
    version: string;
    required_variables?: string[];
    body: string;
}
export interface RenderInput {
    template_id: string;
    deal: Record<string, unknown>;
    overrides?: Record<string, unknown>;
}
export interface RenderOutput {
    markdown: string;
    html: string;
    template_version: string;
}
export declare class TemplateService {
    private templates;
    constructor();
    registerTemplate(template: Template): void;
    clear(): void;
    getById(id: string): Template;
    list(filters?: {
        phase?: string;
        doc_type?: string;
    }): Template[];
    render(input: RenderInput): RenderOutput;
}
//# sourceMappingURL=template.d.ts.map