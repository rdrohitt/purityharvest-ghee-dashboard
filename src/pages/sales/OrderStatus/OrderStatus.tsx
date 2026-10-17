import Shopify from '../Shopify/Shopify';
import type { OrdersTableColumn } from '../Shopify/ShopifyOrdersTable';

const HIDDEN_COLUMNS: readonly OrdersTableColumn[] = [
    'refNo',
    'platform',
    'shipped',
    'type',
    'updatedBy',
    'expectedDelivery',
    'actions',
];

export default function OrderStatus() {
    return (
        <Shopify
            title="Order Status"
            showMetrics={false}
            showCategoryFilter={false}
            hiddenTableColumns={HIDDEN_COLUMNS}
            allowOrderEdit={false}
            selectableOrders
            showShippedFilter={false}
            groupByPickupDate
            showTimelineDateFilters
        />
    );
}
