import React from 'react';
import type { FollowupsToast } from './followupsTypes';

export function ToastContainer({ toasts }: { toasts: FollowupsToast[] }) {
    return (
        <div className="fu-toast-stack">
            {toasts.map((toast) => (
                <div key={toast.id} className="toast fu-toast-item" data-type={toast.type}>
                    <div className="fu-toast-item__row">
                        <span className="fu-toast-item__icon" aria-hidden>
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
