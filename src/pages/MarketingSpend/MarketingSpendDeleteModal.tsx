import type { UnifiedRecord, Platform } from './MarketingSpend';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal/DeleteConfirmModal';

export interface MarketingSpendDeleteModalProps {
    record: UnifiedRecord | null;
    platform: Platform | null;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export function MarketingSpendDeleteModal({
    record,
    platform,
    onConfirm,
    onCancel,
}: MarketingSpendDeleteModalProps) {
    const open = !!record && !!platform;

    return (
        <DeleteConfirmModal
            open={open}
            title="Delete spend?"
            description={
                <>
                    Are you sure you want to delete this marketing spend entry for{' '}
                    {platform ? (
                        <strong>
                            {platform === 'Amazon'
                                ? 'Amazon Wallet'
                                : platform === 'Google Ads'
                                  ? 'Google Ads Wallet'
                                  : platform}
                        </strong>
                    ) : null}
                    ? This action cannot be undone.
                </>
            }
            confirmLabel="Delete"
            busyConfirmLabel="Deleting…"
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
