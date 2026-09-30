GasUsage PWA - Build 1 Version 2

Displayed application version: b1v2
ZIP/build version: 2

This build uses IndexedDB.
Database: GasUsageDB
Object store: SystemLookupCodes

SystemLookupCodes fields:
- SLCId: system-generated IndexedDB auto-increment primary key
- GroupCode: exactly 2 uppercase characters, required
- Order: whole number, required, unique within GroupCode
- ValueCode: exactly 2 uppercase characters, required
- Value: required, maximum 10 characters; mixed case permitted

Open index.html through a web server/PWA host (such as GitHub Pages) for normal browser/PWA use.
