-- Inventory responsibility confirmation and audit trail.
-- Run this migration before deploying the matching PHP/frontend changes.

CREATE TABLE IF NOT EXISTS inventory_transfers (
    inventory_transfer_id INT NOT NULL AUTO_INCREMENT,
    transfer_number VARCHAR(40) NOT NULL,
    from_location_id INT NOT NULL,
    to_location_id INT NOT NULL,
    status ENUM('draft', 'in_transit', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
    notes TEXT DEFAULT NULL,
    created_by_user_id INT NOT NULL,
    received_by_user_id INT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_at DATETIME DEFAULT NULL,
    PRIMARY KEY (inventory_transfer_id),
    UNIQUE KEY inventory_transfer_number_unique (transfer_number),
    CONSTRAINT inventory_transfer_from_fk FOREIGN KEY (from_location_id)
        REFERENCES inventory_locations(location_id),
    CONSTRAINT inventory_transfer_to_fk FOREIGN KEY (to_location_id)
        REFERENCES inventory_locations(location_id),
    CONSTRAINT inventory_transfer_creator_fk FOREIGN KEY (created_by_user_id)
        REFERENCES users(user_id),
    CONSTRAINT inventory_transfer_receiver_fk FOREIGN KEY (received_by_user_id)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_transfer_items (
    inventory_transfer_item_id INT NOT NULL AUTO_INCREMENT,
    inventory_transfer_id INT NOT NULL,
    item_id INT NOT NULL,
    source_batch_id INT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inventory_transfer_item_id),
    KEY inventory_transfer_items_transfer_idx (inventory_transfer_id),
    CONSTRAINT inventory_transfer_items_transfer_fk FOREIGN KEY (inventory_transfer_id)
        REFERENCES inventory_transfers(inventory_transfer_id) ON DELETE CASCADE,
    CONSTRAINT inventory_transfer_items_item_fk FOREIGN KEY (item_id)
        REFERENCES inventory_items(item_id),
    CONSTRAINT inventory_transfer_items_batch_fk FOREIGN KEY (source_batch_id)
        REFERENCES inventory_batches(batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_action_audit (
    inventory_audit_id BIGINT NOT NULL AUTO_INCREMENT,
    action_type VARCHAR(50) NOT NULL,
    item_id INT NULL,
    batch_id INT NULL,
    location_id INT NULL,
    reason TEXT NULL,
    before_state_json LONGTEXT NULL,
    after_state_json LONGTEXT NULL,
    performed_by_user_id INT NOT NULL,
    performed_by_name VARCHAR(220) NOT NULL,
    responsibility_confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inventory_audit_id),
    KEY inventory_audit_item_created_idx (item_id, created_at),
    KEY inventory_audit_user_created_idx (performed_by_user_id, created_at),
    KEY inventory_audit_action_created_idx (action_type, created_at),
    CONSTRAINT inventory_audit_item_fk FOREIGN KEY (item_id)
        REFERENCES inventory_items(item_id) ON DELETE SET NULL,
    CONSTRAINT inventory_audit_batch_fk FOREIGN KEY (batch_id)
        REFERENCES inventory_batches(batch_id) ON DELETE SET NULL,
    CONSTRAINT inventory_audit_location_fk FOREIGN KEY (location_id)
        REFERENCES inventory_locations(location_id) ON DELETE SET NULL,
    CONSTRAINT inventory_audit_user_fk FOREIGN KEY (performed_by_user_id)
        REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE inventory_stock_movements
    MODIFY COLUMN movement_type ENUM(
        'add_item',
        'stock_in',
        'stock_out',
        'adjustment',
        'disposal',
        'transfer_out',
        'transfer_in'
    ) NOT NULL;

SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
      'inventory_action_audit',
      'inventory_transfers',
      'inventory_transfer_items'
  )
ORDER BY TABLE_NAME;
