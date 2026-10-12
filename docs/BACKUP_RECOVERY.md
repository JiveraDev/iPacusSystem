# iPawcus Local Backup Download

> The custom iPawcus backup feature creates complete downloads for the Super Admin's personal computer. It does not retain backup ZIPs in the domain or Hostinger account. Hostinger's hosting backup remains the server-side recovery mechanism.

## What the download contains

Every successful download is a separate ZIP containing:

- `database.sql` — complete database recovery source.
- `media/` — current uploaded files, including saved invoice documents and configured private grooming photos.
- `emergency-operations.xlsx` — readable queue, booking, pet, client, diagnosis, grooming, boarding, inventory, billing, invoice, and action-log worksheets.
- `backup-manifest.json` — package information and component checksums.
- `deleted-files.json` — included for package-format compatibility.
- `RESTORE-INSTRUCTIONS.txt` — recovery checklist.

The Excel workbook is for emergency reading and temporary outage notes. It is not the database restoration source.

## Installation

1. Apply `DDL/20260915_01_system_backups.sql`.
2. In the deployed project `.env`, enable the Super Admin download feature:

   ```env
   IPAWCUS_SYSTEM_BACKUPS_ENABLED=1
   ```

3. Remove these obsolete values if they were added during an earlier setup attempt:

   ```env
   IPAWCUS_BACKUP_STORAGE_ROOT
   IPAWCUS_BACKUP_OFFSITE_LABEL
   IPAWCUS_BACKUP_AUTOMATIC_ENABLED
   IPAWCUS_BACKUP_AUTOMATIC_TIME
   ```

4. Do not create an iPawcus backup cron job. Hostinger's own backup system handles server-side scheduled recovery.
5. Sign in as Super Admin, open **Profile**, then select **Download Backup**.
6. Choose **Create & Download ZIP** and keep the page open until the browser download begins.

The browser's download settings or Save As prompt determines the personal-computer folder. A website cannot silently choose an arbitrary local folder.

## Temporary server processing

PHP must assemble the SQL, workbook, manifest, and ZIP before the browser can receive them. iPawcus uses a unique operating-system temporary directory outside the website files for this processing.

After streaming finishes or fails, iPawcus:

1. Removes the temporary ZIP.
2. Removes the temporary SQL, workbook, state, and working files.
3. Removes the unique temporary directory.
4. Clears the archive and state paths from the database audit record.

Only the audit result remains in `system_backups`; it records who attempted the export, when it ran, its checksum and size, and whether it completed. A completed historical row cannot be downloaded again because no server copy exists. Create a new ZIP when another local copy is needed.

## Verify a downloaded ZIP

1. Confirm the ZIP exists in the browser's Downloads list or selected Save As folder.
2. Open the ZIP and verify the files listed under **What the download contains**.
3. Open `emergency-operations.xlsx` and confirm that its operational worksheets are readable.
4. Keep the ZIP in an encrypted or access-controlled folder on the Super Admin's computer.
5. Copy it to an encrypted external drive if protection against loss of that computer is required.

## Recovery

Recovery is deliberately not exposed as a web button. A trained IT administrator should restore a downloaded ZIP on a clean recovery environment:

1. Preserve the failed server before changing it.
2. Read `backup-manifest.json` and `RESTORE-INSTRUCTIONS.txt`.
3. Import `database.sql` into the intended database.
4. Copy `media/` into the configured runtime media location.
5. Verify login, pets, bookings, queue, diagnoses, grooming, inventory, payments, invoices, and uploaded media.
6. Reconcile any outage work written in the workbook's Offline Entries sheet.
7. Reopen the system only after the recovery checks pass.

Never restore directly over the only production database.

## Security and limits

- Only authenticated Super Admin accounts can create local downloads or view the audit history.
- ZIPs contain confidential clinic and client information and are not password-encrypted. Protect the destination computer and folder.
- Backups do not include `.env`, source code, database credentials, or previous backup ZIPs.
- The built-in ZIP writer supports fewer than 65,536 entries, individual files below 4 GB, and archive offsets below 4 GB.
- Operational Excel worksheets are limited to 250,000 rows. `database.sql` remains the complete recovery source.
