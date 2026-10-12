-- Branch-scoped inventory catalog visibility
--
-- inventory_items remains the shared product definition. This table records
-- whether that product is active at a specific clinic branch, so hiding a
-- product at one clinic does not archive it for every other clinic.

CREATE TABLE IF NOT EXISTS inventory_branch_items (
    branch_id INT NOT NULL,
    item_id INT NOT NULL,
    primary_location_id INT NOT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    removed_at DATETIME NULL,
    removed_by_user_id INT NULL,
    removal_reason VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (branch_id, item_id),
    KEY inventory_branch_items_item_idx (item_id, status),
    KEY  (primary_location_id),
    KEY inventory_branch_items_removed_by_idx (removed_by_user_id),
    CONSTRAINT inventory_branch_items_branch_fk
        FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
    CONSTRAINT inventory_branch_items_item_fk
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id),
    CONSTRAINT inventory_branch_items_location_fk
        FOREIGN KEY (primary_location_id) REFERENCES inventory_locations(location_id),
    CONSTRAINT inventory_branch_items_removed_by_fk
        FOREIGN KEY (removed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Preserve the product's configured location, including products created with
-- zero opening stock and therefore no inventory batch yet.
INSERT INTO inventory_branch_items (
    branch_id,
    item_id,
    primary_location_id,
    status
)
SELECT
    location.branch_id,
    item.item_id,
    item.location_id,
    CASE WHEN item.status = 'active' THEN 'active' ELSE 'inactive' END
FROM inventory_items item
JOIN inventory_locations location ON location.location_id = item.location_id
ON DUPLICATE KEY UPDATE
    primary_location_id = VALUES(primary_location_id);

-- A shared catalog product may have stock at additional branches. Add one
-- branch record for each real batch location instead of displaying it at all
-- branches through a synthetic fallback location.
INSERT INTO inventory_branch_items (
    branch_id,
    item_id,
    primary_location_id,
    status
)
SELECT
    location.branch_id,
    batch.item_id,
    MIN(batch.location_id),
    CASE WHEN item.status = 'active' THEN 'active' ELSE 'inactive' END
FROM inventory_batches batch
JOIN inventory_locations location ON location.location_id = batch.location_id
JOIN inventory_items item ON item.item_id = batch.item_id
GROUP BY location.branch_id, batch.item_id, item.status
ON DUPLICATE KEY UPDATE
    primary_location_id = inventory_branch_items.primary_location_id;

SELECT
    COUNT(*) AS branch_inventory_records,
    SUM(status = 'active') AS active_branch_inventory_records,
    SUM(status = 'inactive') AS inactive_branch_inventory_records
FROM inventory_branch_items;
