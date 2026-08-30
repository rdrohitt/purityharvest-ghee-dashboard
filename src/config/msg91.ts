const envAuthkey = String(import.meta.env.VITE_MSG91_AUTHKEY ?? '').trim();

const numbers = {
    monia: '919217609162',
    sarita: '918168024581',
} as const;

/**
 * MSG91 WhatsApp settings — import this file anywhere we call MSG91
 * (Get Templates, Send Template, Logs, etc.).
 *
 * Override `authkey` with VITE_MSG91_AUTHKEY in `.env.development` / `.env.production`
 * without changing this file.
 */
export const MSG91 = {
    authkey: envAuthkey || '531577AfHTfoOUIJ6a509453P1',
    controlBaseUrl: 'https://control.msg91.com',
    apiBaseUrl: 'https://api.msg91.com',
    outboundPath: '/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
    numbers,
    numberOptions: [
        { value: numbers.monia, label: `Monia · ${numbers.monia}` },
        { value: numbers.sarita, label: `Sarita · ${numbers.sarita}` },
    ],
} as const;

/** Headers matching the MSG91 GET curl (accept, authkey, content-type). */
export function msg91RequestHeaders(): Headers {
    const headers = new Headers();
    headers.set('accept', 'application/json');
    headers.set('authkey', MSG91.authkey);
    headers.set('content-type', 'text/plain');
    return headers;
}

/** Headers for MSG91 JSON POST (send template). */
export function msg91JsonHeaders(): Headers {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('authkey', MSG91.authkey);
    return headers;
}
