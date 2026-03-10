export type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div className="shopify-toast-container">
            {toasts.map((toast) => (
                <div key={toast.id} className="toast shopify-toast" data-type={toast.type}>
                    <div className="shopify-toast-content">
                        <span className="shopify-toast-icon">
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
