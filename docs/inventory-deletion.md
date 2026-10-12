# Report-safe inventory removal

Removing one or many products now marks the selected clinic's
`inventory_branch_items` rows as `inactive`. The shared `inventory_items`
catalog record and every other clinic's branch record remain unchanged. The
products disappear from active inventory and cannot be used for new stock
operations at the selected clinic, while product identity, batches, stock
receipts, stock movements, transfers, invoice charges, payments, refunds, and
inventory audit entries remain unchanged for historical reporting.

The Inventory Status report uses the same branch scope and shows active products
for the selected clinic only. Removing a product from Clinic A does not remove
it from Clinic B's inventory screen or current-state report. Historical Stock
Movement, medicine/product sales, billing, payment, and refund reports continue
to retain the removed product data.

Run `DDL/20260930_01_inventory_branch_catalog.sql` before deploying the matching
backend. It creates and backfills the clinic-to-product relationship from real
product locations and inventory batches. The migration is repeat-safe and does
not overwrite a branch removal recorded after its first run. Single and bulk
removal use one transaction; if any selected product does not belong to the
selected clinic, the entire selection is rolled back.

Password confirmation, branch access, responsibility acknowledgement, and a
reason are required. One inventory audit row is written for every removed
clinic product, including the branch ID and confirmation that other clinics were
unchanged. The staff activity log records the bulk action with product names.

Verification:

```powershell
php -l php/inventory.php
php -l php/staff_activity_helpers.php
npx eslint src/components/AdminDashboardsComponent/AllItemsPage.jsx
npm run build
```
