import type { AdScriptApi } from '../../types/ad-scripts';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal/DeleteConfirmModal';

type Props = {
    script: AdScriptApi | null;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
};

export function ScriptDeleteModal({ script, onConfirm, onCancel }: Props) {
    const title = String(script?.title ?? '').trim();

    return (
        <DeleteConfirmModal
            open={Boolean(script)}
            title="Delete script?"
            description={
                <>
                    Are you sure you want to delete this script? This action cannot be undone.
                </>
            }
            details={
                title ? (
                    <>
                        <div className="delete-modal-customer-label">Script</div>
                        <div className="delete-modal-customer-name">{title}</div>
                        {String(script?.category ?? '').trim() ? (
                            <div className="delete-modal-customer-amount">{String(script?.category).trim()}</div>
                        ) : null}
                    </>
                ) : undefined
            }
            confirmLabel="Delete script"
            busyConfirmLabel="Deleting…"
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
