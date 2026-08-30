import { useCallback, useState } from 'react';
import '../sales/Shopify/Shopify.scss';
import SendTemplateModal from './SendTemplateModal';

function SendTemplateIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
                d="M22 2 11 13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M22 2 15 22 11 13 2 9 22 2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function SendTemplateTab({ defaultIntegratedNumber }: { defaultIntegratedNumber: string }) {
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);

    return (
        <div className="wa-send-tab">
            <div className="wa-send-hero">
                <div className="wa-send-hero-icon" aria-hidden>
                    <SendTemplateIcon />
                </div>
                <h3 className="wa-send-hero-title">Send a WhatsApp template</h3>
                <p className="wa-send-hero-copy">
                    Choose recipients, pick an approved template, and review the message before you send.
                </p>
                <button
                    type="button"
                    className="button shopify-add-order-btn wa-send-hero-btn"
                    onClick={() => setOpen(true)}
                >
                    Send Template
                </button>
            </div>
            {open ? (
                <SendTemplateModal defaultIntegratedNumber={defaultIntegratedNumber} onClose={close} />
            ) : null}
        </div>
    );
}
