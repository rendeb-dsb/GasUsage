GasUsage PWA - Build 1 Version 3

Displayed application version: b1v3
ZIP/build version: 3

This build uses IndexedDB.
Database: GasUsageDB
Object store: SystemLookupCodes

SystemLookupCodes fields:
- SLCId: system-generated IndexedDB auto-increment primary key
- GroupCode: exactly 2 uppercase characters, required
- Order: whole number, required, unique within GroupCode
- ValueCode: exactly 2 uppercase characters, required
- Value: required; mixed case permitted; no character limit

Open index.html through a web server/PWA host (such as GitHub Pages) for normal browser/PWA use.

JSON file management:
- Actions > Export creates SystemLookupCodes.json containing the current SLC data.
- Actions > Import accepts a previously exported JSON file and replaces the current SLC data after confirmation.
