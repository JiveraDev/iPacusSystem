# Database DDL Export

Run this from the project root:

```bash
php DDL/export_database_ddl.php
```

It reads the database connection from `.env` and writes a timestamped file like:

```text
DDL/database_ddl_20260530_213000.sql
```

Optional commands:

```bash
php DDL/export_database_ddl.php --output DDL/current_schema.sql
php DDL/export_database_ddl.php --include-views
```
