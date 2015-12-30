/* Create statements for the invoice db for SQLite */
CREATE TABLE "biller" (
	`id`	TEXT NOT NULL UNIQUE,
	`name`	TEXT,
	`street`	TEXT,
	`postal`	TEXT,
	`city`	TEXT,
	`nation`	TEXT,
	`tax_id`	TEXT,
	PRIMARY KEY(id)
);

CREATE TABLE "banking" (
	`id`	TEXT NOT NULL UNIQUE,
	`biller_id`	TEXT,
	`caption`	TEXT,
	`institute`	TEXT,
	`swift`	TEXT,
	`iban`	TEXT,
	PRIMARY KEY(id),
	FOREIGN KEY(`biller_id`) REFERENCES biller ( id )
);

CREATE TABLE "customer" (
	`id`	TEXT NOT NULL UNIQUE,
	`name`	TEXT,
	`street`	NUMERIC,
	`postal`	TEXT,
	`city`	TEXT,
	`nation`	TEXT,
	`tax_id`	TEXT,
	`terms_amount`	INTEGER,
	`terms_unit`	TEXT,
	PRIMARY KEY(id)
);

CREATE TABLE "item" (
	`id`	TEXT NOT NULL UNIQUE,
	`customer_id`	TEXT,
	`caption`	TEXT,
	`description`	TEXT,
	`unit`	TEXT,
	`unit_price`	REAL,
	`currency`	TEXT,
	`tax_percentage`	REAL,
	PRIMARY KEY(id),
	FOREIGN KEY(`customer_id`) REFERENCES customer(id)
);

CREATE TABLE "invoice" (
	`id`	TEXT NOT NULL UNIQUE,
	`issue_date`	TEXT,
	`biller_id`	TEXT,
	`customer_id`	TEXT,
	`delivery_date`	TEXT,
	`periode_from`	TEXT,
	`periode_to`	TEXT,
	`currency`	TEXT,
	`total_net`	REAL,
	`total_tax`	REAL,
	`total_gross`	REAL,
	`export_date`	TEXT,
	`payment_date`	TEXT,
	PRIMARY KEY(id),
	FOREIGN KEY(`biller_id`) REFERENCES biller ( id ),
	FOREIGN KEY(`customer_id`) REFERENCES customer(id)
);

CREATE TABLE "invoice_item" (
	`invoice_id`	TEXT,
	`position`	INTEGER,
	`description`	TEXT,
	`unit`	TEXT,
	`unit_price`	REAL,
	`tax_percentage`	REAL,
	`discount_percentage`	REAL,
	`quantity`	REAL,
	`price_net`	REAL,
	FOREIGN KEY(`invoice_id`) REFERENCES invoice ( id )
);
