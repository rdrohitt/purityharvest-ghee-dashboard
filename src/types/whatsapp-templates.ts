/** Header / body / footer / button block on a MSG91 WhatsApp template language. */
export interface Msg91TemplateCodeExample {
    header_handle?: string[];
    header_text?: string[];
    body_text?: string[][];
}

export interface Msg91TemplateCodeBlock {
    type: string;
    format?: string;
    text?: string;
    example?: Msg91TemplateCodeExample;
}

export interface Msg91TemplateVariableType {
    type: string;
}

export interface Msg91TemplateLanguage {
    id: string;
    msg91_template_id: number;
    name: string;
    language: string;
    parameter_format: string;
    status: string;
    rejection_reason: string;
    variables: string[];
    variable_type: Record<string, Msg91TemplateVariableType>;
    is_disabled: number;
    code: Msg91TemplateCodeBlock[];
}

export interface Msg91WhatsAppTemplate {
    category: string;
    name: string;
    namespace: string;
    languages: Msg91TemplateLanguage[];
}

/** Envelope from GET /api/v5/whatsapp/get-template-client/:number */
export interface Msg91GetTemplatesResponse {
    status: string;
    hasError: boolean;
    data: Msg91WhatsAppTemplate[];
    errors: unknown;
}

/** Flattened row for the Get Templates table (one row per language). */
export interface WhatsAppTemplateTableRow {
    key: string;
    name: string;
    category: string;
    namespace: string;
    language: string;
    status: string;
    parameterFormat: string;
    templateId: number | string;
    variables: string[];
    headerFormat: string;
    headerImageUrl?: string;
    body: string;
    footer: string;
    disabled: boolean;
}

export interface Msg91SendTemplateComponent {
    type: string;
    value: string;
}

export interface Msg91SendTemplateRequest {
    integrated_number: string;
    content_type: 'template';
    payload: {
        messaging_product: 'whatsapp';
        type: 'template';
        template: {
            name: string;
            language: {
                code: string;
                policy: 'deterministic';
            };
            namespace: string;
            to_and_components: Array<{
                to: string[];
                components: Record<string, Msg91SendTemplateComponent>;
            }>;
        };
    };
}
