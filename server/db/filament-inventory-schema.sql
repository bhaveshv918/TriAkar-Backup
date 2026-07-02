-- =====================================================================
-- TriAkar | 3D Filament Inventory
-- Source: New 3D_Filament_Inventory.xlsx (sheet: "Filament Inventory")
-- Rows imported: 80 (S.No 1-80, i.e. Excel rows 2-81)
--
-- EXCLUDED FROM IMPORT (not part of the main inventory table):
--   1. Excel rows 82-241: leftover autofill junk (S.No + Size=1 only,
--      every other column blank) - not real inventory records.
--   2. Columns P, Q, R, S (headers: Color / Company / Qty / What Not),
--      starting at row 4: a small, separate reference/wishlist table of
--      colors-to-buy per vendor. Structurally unrelated to the main
--      inventory columns (misaligned start row, different meaning).
--      Not imported. Tell me if you want this as its own small table.
--
-- Column mapping (Excel header -> SQL column):
--   S No.       -> s_no             INTEGER  (original serial number from sheet)
--   Vendor      -> vendor           VARCHAR(50), NULL  (purchase source, ~19 rows blank)
--   Brand       -> brand            VARCHAR(50), NOT NULL
--   F.Type      -> filament_type    VARCHAR(30), NOT NULL  (e.g. PLA, PETG, TPU, ABS)
--   Finish      -> finish           VARCHAR(30)  (e.g. Normal, Matte, Silk, Glow)
--   Color       -> color            VARCHAR(50)
--   Size        -> size_kg          DECIMAL(4,2)  (spool size in kg; always 1 except one NULL row)
--   Qty         -> qty_remaining    DECIMAL(4,2)  (fraction of spool remaining, 0.00-1.00)
--   Position    -> position         VARCHAR(20)  (physical location tag: Box/NB/OUT/LU/Seal)
--   Box Name    -> box_name         VARCHAR(30)  (storage box label)
--   Status      -> status           VARCHAR(20)  (Opened/Finsh/Packed/TBR - kept as-is from sheet, incl. "Finsh" typo)
--   Price (Rs.) -> price            DECIMAL(10,2)  (INR)
--   Name        -> purchased_via    VARCHAR(30)  (buyer/reseller tag: Shru, Akans, Amz, 3dbzr, Z3D - rename if you have a better label)
--   Undefined   -> notes            VARCHAR(100)  (sparse free-text notes: "RETURNED", "New color")
-- =====================================================================

CREATE TABLE filament_inventory (
    id              SERIAL PRIMARY KEY,
    s_no            INTEGER NOT NULL UNIQUE,
    vendor          VARCHAR(50),
    brand           VARCHAR(50) NOT NULL,
    filament_type   VARCHAR(30) NOT NULL,
    finish          VARCHAR(30),
    color           VARCHAR(50),
    size_kg         DECIMAL(4,2),
    qty_remaining   DECIMAL(4,2),
    position        VARCHAR(20),
    box_name        VARCHAR(30),
    status          VARCHAR(20),
    price           DECIMAL(10,2),
    purchased_via   VARCHAR(30),
    notes           VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- Data (80 rows)
-- =====================================================================

INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (1, 'WOL3D', 'WOL3D', 'PLA PRO+', 'Normal', 'Ivory', 1, 0.05, 'Box', 'most using', 'Opened', 850, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (2, 'Elegoo', 'Elegoo', 'PLA', 'Normal', 'Brown', 1, 0, 'Box', 'most using', 'Finsh', 2000, '3dbzr', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (3, 'Elegoo', 'Elegoo', 'PLA', 'Normal', 'Red', 1, 0, 'Box', 'most using', 'Finsh', 900, '3dbzr', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (4, 'WOL3D', 'WOL3D', 'PLA', 'Transparent', 'Transparent', 1, 0.7, 'Box', 'shiny', 'Opened', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (5, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Forest Green', 1, 0.75, 'Box', 'shiny', 'Opened', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (6, 'Other', 'Nfil 3D', 'PLA+', 'Normal', 'Orange', 1, 0.15, 'Box', 'shiny', 'Opened', 670, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (7, 'Other', 'Haiteng', 'PETG', 'Marble', 'Marble', 1, 0, 'Box', 'PETG', 'Opened', 1000, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (8, 'ESUN', 'ESUN', 'PETG', 'Normal', 'Black', 1, 0.75, 'Box', 'PETG', 'Opened', 1250, '3dbzr', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (9, 'ESUN', 'ESUN', 'PETG', 'Normal', 'White', 1, 0.55, 'Box', 'PETG', 'Opened', 1250, '3dbzr', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (10, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Lime Green', 1, 0, 'Box', 'Ending', 'Opened', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (11, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Yellow', 1, 0, 'Box', 'Ending', 'Finsh', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (12, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Natural White', 1, 0, 'Box', 'Ending', 'Finsh', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (13, 'Other', 'Haiteng', 'PLA', 'Silk', 'Golden Silk', 1, 0.1, 'Box', 'shiny', 'Opened', 1300, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (14, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Baby Pink', 1, 0.02, 'Box', 'shiny', 'Finsh', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (15, 'Elegoo', 'Elegoo', 'PLA', 'Silk', 'Blue Purple', 1, 0.25, 'Box', 'shiny', 'Opened', 1450, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (16, 'Elegoo', 'Elegoo', 'PLA', 'Matte', 'Light Blue', 1, 0.35, 'Box', 'MATT', 'Opened', 1200, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (17, 'Other', 'Polymaker', 'PLA', 'Matte', 'Rainbow', 1, 0.5, 'Box', 'MATT', 'Opened', 1800, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (18, 'WOL3D', 'Bramma Lab', 'TPU', 'Soft', 'White', 1, 0.85, 'Box', 'TPU', 'Opened', 1200, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (19, '3IDEA', '3IDEA', 'PLA', 'Normal', 'Black', 1, 0, 'Box', 'MATT', 'Opened', 730, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (20, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Candy Red', 1, 0, 'Box', 'shiny', 'Opened', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (21, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'White', 1, 0, 'Box', 'MATT', 'Finsh', 725, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (22, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Gray', 1, 0.6, 'Box', 'shiny', 'Opened', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (23, 'Other', 'Haiteng', 'PLA', 'Silk', 'Golden Silk', 1, 1, 'NB', 'shiny', 'Packed', 1300, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (24, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Dark Blue', 1, 0.95, 'NB', 'shiny', 'Packed', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (25, 'WOL3D', 'Bramma Lab', 'PLA', 'Normal', 'Yellow', 1, 1, 'NB', 'MATT', 'Packed', 1200, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (26, 'Elegoo', 'Elegoo', 'PLA', 'Matte', 'Black', 1, 0.7, 'OUT', 'MATT', 'Opened', 1200, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (27, 'Elegoo', 'Elegoo', 'PLA', 'Matte', 'Yellow', 1, 0.5, 'NB', 'MATT', 'Opened', 1200, 'Amz', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (28, 'WOL3D', 'WOL3D', 'PLA PRO+', 'Normal', 'Blue', 1, 0.2, 'Box', 'MATT', 'Opened', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (29, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Daisy', 1, 0, NULL, 'MATT', 'Finsh', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (30, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Daisy', 1, 0.9, NULL, 'MATT', 'TBR', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (31, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Midnight Black', 1, 0, NULL, 'MATT', 'Finsh', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (32, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Natural White', 1, 1, 'LU', 'shiny', 'Packed', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (33, 'WOL3D', 'WOL3D', 'PLA', 'Normal', 'Green', 1, 1, 'LU', 'MATT', 'Packed', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (34, 'Amazon', 'Numakers', 'PLA+', 'Matte', 'RUST COPPER', 1, 0, NULL, 'MATT', 'Packed', 950, 'Amz', 'RETURNED');
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (35, 'Amazon', 'Elegoo', 'PLA+', 'Matte', 'Grey Matte', 1, 0, NULL, 'MATT', 'Packed', 1080, 'Amz', 'RETURNED');
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (36, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Pitch Black', 1, 0.7, 'OUT', NULL, 'Opened', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (37, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Pure White', 1, 1, 'Seal', NULL, 'Packed', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (38, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Apricot skin', 1, 0.6, 'OUT', NULL, 'Opened', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (39, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Beige Brown', 1, 0.3, 'OUT', NULL, 'Opened', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (40, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Atomic Pink', 1, 0.75, 'OUT', NULL, 'Opened', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (41, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Grass Green', 1, 1, 'Seal', NULL, 'Packed', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (42, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Magenta', 1, 1, 'Seal', NULL, 'Packed', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (43, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Ivory', 1, 0.15, 'Seal', NULL, 'Packed', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (44, 'Numakers', 'Numakers', 'PLA Pro', 'Normal', 'Light Gray', 1, 0.9, 'OUT', NULL, 'Packed', 607, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (45, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Lagoon Blue', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (46, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Thanos Purple', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (47, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Midnight Gray', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (48, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Chocolate Brown', 1, 0.2, 'OUT', NULL, 'Opened', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (49, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Lavender Violet', 1, 0.8, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (50, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Mauve Purple', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (51, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Military Khaki', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (52, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Teal Blue', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (53, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Nuclear Red', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (54, 'Numakers', 'Numakers', 'HS-PETG', 'Translucent', 'Arctic', 1, 0.8, 'Seal', NULL, 'Packed', 648, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (55, 'Numakers', 'Numakers', 'HS-PETG', 'Translucent', 'Ice Blue', 1, 1, 'Seal', NULL, 'Packed', 648, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (56, 'Numakers', 'Numakers', 'ASA', 'Normal', 'Pure White', 1, 1, 'Seal', NULL, 'Packed', 766, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (57, 'Numakers', 'Numakers', 'PLA', 'Silk', 'Obsidian Night', 1, 1, 'Seal', NULL, 'Packed', 825, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (58, 'Numakers', 'Numakers', 'Tri-Color', 'Silk', 'Green-Magenta-Blue', 1, 1, 'Seal', NULL, 'Packed', 825, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (59, 'Numakers', 'Numakers', 'ABS', 'Normal', 'Pitch Black', 1, 1, 'Seal', NULL, 'Packed', 650, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (60, 'Numakers', 'Numakers', 'PLA', 'Glow', 'Aqua Blue', 1, 1, 'Seal', NULL, 'Packed', 1033, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (61, 'Numakers', 'Numakers', 'PLA+', 'Normal', 'Marble', 1, 0.9, 'Seal', NULL, 'Packed', 707, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (62, NULL, 'JAMGHE', 'PLA', 'Natural', 'Wood', NULL, 1, 'Seal', NULL, 'Packed', 1400, 'Z3D', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (63, NULL, 'Numakers', 'PLA+', 'Normal', 'Ivory', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (64, NULL, 'Numakers', 'PLA+', 'Normal', 'Ivory', 1, 0.15, 'OUT', NULL, 'Opened', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (65, NULL, 'Numakers', 'PLA+', 'Normal', 'Ivory', 1, 0.15, 'OUT', NULL, 'Opened', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (66, NULL, 'Elegoo', 'PLA+', 'Normal', 'Sky Blue', 1, 0.7, 'OUT', NULL, 'Opened', 649, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (67, NULL, 'Numakers', 'PLA', 'Matte', 'White', 1, 0.9, 'OUT', NULL, 'Opened', 600, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (68, NULL, 'Elegoo', 'PLA+', 'Normal', 'Brown', 1, 1, 'Seal', NULL, 'Packed', 850, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (69, NULL, 'Numakers', 'PLA PRO+', 'Normal', 'Light Grey', 1, 0.9, 'OUT', NULL, 'Opened', 650, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (70, NULL, 'WOL3D', 'PLA PRO+', 'Normal', 'Tiger Orange', 1, 1, 'Seal', NULL, 'Packed', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (71, NULL, 'WOL3D', 'PLA PRO+', 'Normal', 'Ivory', 1, 1, 'Seal', NULL, 'Packed', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (72, NULL, 'Numakers', 'PLA', 'DUEL COLOR', 'ORANGE-RED', 1, 1, 'Seal', NULL, 'Packed', 800, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (73, NULL, 'Numakers', 'PLA+', 'Normal', 'Cool White', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (74, NULL, 'Numakers', 'PLA', 'Mettalic', 'Burnt Copper', 1, 1, 'Seal', NULL, 'Packed', 800, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (75, NULL, 'Numakers', 'PLA+', 'Normal', 'Pure White', 1, 1, 'Seal', NULL, 'Packed', 649, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (76, NULL, 'Numakers', 'PLA', 'Matte', 'Olive Green', 1, 1, 'Seal', NULL, 'Packed', 700, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (77, NULL, 'Numakers', 'PLA', 'Matte', 'Mint Green', 1, 1, 'Seal', NULL, 'Packed', 700, 'Akans', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (78, NULL, 'Numakers', 'PLA', 'Silk', 'Yellow', 1, 1, 'Seal', NULL, 'Packed', 700, 'Akans', 'New color');
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (79, NULL, 'WOL3D', 'PLA PRO+', 'Normal', 'Daisy', 1, 1, 'Seal', NULL, 'Packed', 600, 'Shru', NULL);
INSERT INTO filament_inventory (s_no, vendor, brand, filament_type, finish, color, size_kg, qty_remaining, position, box_name, status, price, purchased_via, notes) VALUES (80, NULL, 'Numakers', 'PLA+', 'Normal', 'Simply Silver', 1, 1, 'Seal', NULL, 'Packed', 700, 'Akans', NULL);
