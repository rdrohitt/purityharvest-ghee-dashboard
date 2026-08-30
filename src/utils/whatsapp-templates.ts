import { MSG91, msg91JsonHeaders, msg91RequestHeaders } from '../config/msg91';
import type {
    Msg91GetTemplatesResponse,
    Msg91SendTemplateComponent,
    Msg91SendTemplateRequest,
    Msg91TemplateCodeBlock,
    Msg91TemplateLanguage,
    Msg91WhatsAppTemplate,
    WhatsAppTemplateTableRow,
} from '../types/whatsapp-templates';

export const MONIA_WHATSAPP_NUMBER = MSG91.numbers.monia;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function parseCodeBlock(raw: unknown): Msg91TemplateCodeBlock | null {
    const o = asRecord(raw);
    if (!o) return null;
    const exampleRaw = asRecord(o.example);
    return {
        type: asString(o.type),
        format: o.format == null ? undefined : asString(o.format),
        text: o.text == null ? undefined : asString(o.text),
        example: exampleRaw
            ? {
                  header_handle: Array.isArray(exampleRaw.header_handle)
                      ? exampleRaw.header_handle.map((v) => asString(v))
                      : undefined,
              }
            : undefined,
    };
}

function parseLanguage(raw: unknown): Msg91TemplateLanguage | null {
    const o = asRecord(raw);
    if (!o) return null;
    const variableTypeRaw = asRecord(o.variable_type) ?? {};
    const variable_type: Msg91TemplateLanguage['variable_type'] = {};
    for (const [key, val] of Object.entries(variableTypeRaw)) {
        const inner = asRecord(val);
        variable_type[key] = { type: asString(inner?.type) };
    }
    return {
        id: asString(o.id),
        msg91_template_id: asNumber(o.msg91_template_id),
        name: asString(o.name),
        language: asString(o.language),
        parameter_format: asString(o.parameter_format),
        status: asString(o.status),
        rejection_reason: asString(o.rejection_reason),
        variables: Array.isArray(o.variables) ? o.variables.map((v) => asString(v)) : [],
        variable_type,
        is_disabled: asNumber(o.is_disabled),
        code: Array.isArray(o.code)
            ? o.code.map(parseCodeBlock).filter((b): b is Msg91TemplateCodeBlock => b != null)
            : [],
    };
}

export function parseGetTemplatesResponse(raw: unknown): Msg91GetTemplatesResponse {
    const o = asRecord(raw);
    if (!o) {
        throw new Error('Invalid templates response');
    }
    const data = Array.isArray(o.data)
        ? o.data
              .map((item) => {
                  const t = asRecord(item);
                  if (!t) return null;
                  const template: Msg91WhatsAppTemplate = {
                      category: asString(t.category),
                      name: asString(t.name),
                      namespace: asString(t.namespace),
                      languages: Array.isArray(t.languages)
                          ? t.languages
                                .map(parseLanguage)
                                .filter((l): l is Msg91TemplateLanguage => l != null)
                          : [],
                  };
                  return template;
              })
              .filter((t): t is Msg91WhatsAppTemplate => t != null)
        : [];

    return {
        status: asString(o.status),
        hasError: Boolean(o.hasError),
        data,
        errors: o.errors ?? null,
    };
}

function findCode(code: Msg91TemplateCodeBlock[], type: string): Msg91TemplateCodeBlock | undefined {
    return code.find((block) => block.type.toUpperCase() === type);
}

export function flattenTemplateRows(templates: Msg91WhatsAppTemplate[]): WhatsAppTemplateTableRow[] {
    const rows: WhatsAppTemplateTableRow[] = [];
    for (const template of templates) {
        const languages: Array<Msg91TemplateLanguage | null> =
            template.languages.length > 0 ? template.languages : [null];
        languages.forEach((lang, index) => {
            const header = lang ? findCode(lang.code, 'HEADER') : undefined;
            const body = lang ? findCode(lang.code, 'BODY') : undefined;
            const footer = lang ? findCode(lang.code, 'FOOTER') : undefined;
            rows.push({
                key: `${template.namespace}-${template.name}-${lang?.id ?? index}`,
                name: lang?.name || template.name,
                category: template.category,
                namespace: template.namespace,
                language: lang?.language ?? '—',
                status: lang?.status ?? '—',
                parameterFormat: lang?.parameter_format ?? '—',
                templateId: lang?.msg91_template_id ?? '—',
                variables: lang?.variables ?? [],
                headerFormat: header?.format ?? '—',
                headerImageUrl: header?.example?.header_handle?.[0],
                body: body?.text ?? '',
                footer: footer?.text ?? '',
                disabled: lang?.is_disabled === 1,
            });
        });
    }
    return rows;
}

function buildGetTemplatesUrl(integratedNumber: string): string {
    const params = new URLSearchParams({
        page_num: '1',
        page_size: '100',
        pagination: 'Value',
        template_name: '',
        template_status: '',
        template_language: '',
    });
    const path = `/api/v5/whatsapp/get-template-client/${encodeURIComponent(integratedNumber)}?${params.toString()}`;
    // Vite proxies /msg91 → control.msg91.com so the browser is not blocked by CORS.
    if (import.meta.env.DEV) {
        return `/msg91${path}`;
    }
    return `${MSG91.controlBaseUrl}${path}`;
}

export async function fetchWhatsAppTemplates(
    integratedNumber: string,
): Promise<Msg91WhatsAppTemplate[]> {
    const response = await fetch(buildGetTemplatesUrl(integratedNumber), {
        method: 'GET',
        headers: msg91RequestHeaders(),
    });
    const raw: unknown = await response.json().catch(() => null);

    if (!response.ok) {
        const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
        const message =
            (typeof rec?.message === 'string' && rec.message) ||
            (typeof rec?.error === 'string' && rec.error) ||
            `Failed to load templates (${response.status})`;
        throw new Error(message);
    }

    const parsed = parseGetTemplatesResponse(raw);
    if (parsed.hasError || parsed.status.toLowerCase() !== 'success') {
        throw new Error('MSG91 returned an error while loading templates');
    }
    return parsed.data;
}

function msg91ErrorMessage(raw: unknown, fallback: string): string {
    const rec = asRecord(raw);
    if (!rec) return fallback;
    if (typeof rec.message === 'string' && rec.message.trim()) return rec.message;
    if (typeof rec.error === 'string' && rec.error.trim()) return rec.error;
    if (Array.isArray(rec.errors) && rec.errors.length > 0) {
        const first = rec.errors[0];
        if (typeof first === 'string') return first;
        const inner = asRecord(first);
        if (typeof inner?.message === 'string') return inner.message;
    }
    return fallback;
}

export function parsePhoneNumbers(raw: string): string[] {
    const seen = new Set<string>();
    const numbers: string[] = [];
    for (const part of raw.split(/[\s,;]+/)) {
        let digits = part.replace(/\D/g, '');
        if (digits.length === 10) digits = `91${digits}`;
        if (digits.length < 11) continue;
        if (seen.has(digits)) continue;
        seen.add(digits);
        numbers.push(digits);
    }
    return numbers;
}

export function pickTemplateLanguage(template: Msg91WhatsAppTemplate): Msg91TemplateLanguage | undefined {
    const langs = template.languages.filter((l) => l.is_disabled !== 1);
    return (
        langs.find((l) => l.language.toLowerCase() === 'en' && l.status.toLowerCase() === 'approved') ??
        langs.find((l) => l.status.toLowerCase() === 'approved') ??
        langs[0]
    );
}

export function getTemplatePreviewContent(template: Msg91WhatsAppTemplate): {
    body: string;
    footer: string;
    headerFormat: string;
    headerImageUrl?: string;
} {
    const lang = pickTemplateLanguage(template);
    const header = lang ? findCode(lang.code, 'HEADER') : undefined;
    const body = lang ? findCode(lang.code, 'BODY') : undefined;
    const footer = lang ? findCode(lang.code, 'FOOTER') : undefined;
    return {
        body: body?.text ?? '',
        footer: footer?.text ?? '',
        headerFormat: header?.format ?? '',
        headerImageUrl: header?.example?.header_handle?.[0],
    };
}

export function buildSendComponents(template: Msg91WhatsAppTemplate): Record<string, Msg91SendTemplateComponent> {
    const lang = pickTemplateLanguage(template);
    if (!lang) return {};
    const header = findCode(lang.code, 'HEADER');
    const components: Record<string, Msg91SendTemplateComponent> = {};
    for (const name of lang.variables) {
        const type = (lang.variable_type[name]?.type || 'text').toLowerCase();
        if (type === 'image') {
            components[name] = {
                type: 'image',
                value: header?.example?.header_handle?.[0] ?? '',
            };
        }
    }
    return components;
}

export function buildSendTemplateRequest(input: {
    integratedNumber: string;
    template: Msg91WhatsAppTemplate;
    to: string[];
    headerMediaUrl?: string;
}): Msg91SendTemplateRequest {
    const lang = pickTemplateLanguage(input.template);
    const components = buildSendComponents(input.template);
    if (input.headerMediaUrl) {
        for (const [key, component] of Object.entries(components)) {
            if (component.type === 'image') {
                components[key] = { ...component, value: input.headerMediaUrl };
            }
        }
    }
    return {
        integrated_number: input.integratedNumber,
        content_type: 'template',
        payload: {
            messaging_product: 'whatsapp',
            type: 'template',
            template: {
                name: input.template.name,
                language: {
                    code: lang?.language || 'en',
                    policy: 'deterministic',
                },
                namespace: input.template.namespace,
                to_and_components: [
                    {
                        to: input.to,
                        components,
                    },
                ],
            },
        },
    };
}

export async function sendWhatsAppTemplate(body: Msg91SendTemplateRequest): Promise<void> {
    const url = import.meta.env.DEV
        ? `/msg91-api${MSG91.outboundPath}`
        : `${MSG91.apiBaseUrl}${MSG91.outboundPath}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: msg91JsonHeaders(),
        body: JSON.stringify(body),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(msg91ErrorMessage(raw, `Failed to send template (${response.status})`));
    }
    const rec = asRecord(raw);
    const status = asString(rec?.status).toLowerCase();
    const hasError = Boolean(rec?.hasError);
    if (hasError || (status && status !== 'success')) {
        throw new Error(msg91ErrorMessage(raw, 'MSG91 returned an error while sending the template'));
    }
}
