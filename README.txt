GasUsage PWA - Build 1 Version 9

Displayed application version: b1v9
ZIP/build version: 7

This build uses IndexedDB.
Database: GasUsageDB
Object store: SystemLookupCodes

SystemLookupCodes fields:
- SLCId: system-generated IndexedDB auto-increment primary key
- GroupCode: exactly 2 uppercase characters, required
- Order: whole number, required, unique within GroupCode
- ValueCode: exactly 2 uppercase characters, required
- Value: required; mixed case permitted; no character limit

Record controls:
- + clears the entry fields and focuses Group Code.
- - requires a selected row and displays an in-app delete confirmation.
- • loads the selected row for editing.
- Save adds a new record or updates the record being edited.
- After an update, the updated row remains selected and the entry fields are cleared.

JSON:
- Actions > Export creates SystemLookupCodes.json.
- Actions > Import accepts an exported JSON file and replaces the current SLC data after confirmation.
