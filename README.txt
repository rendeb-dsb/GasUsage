GasUsage PWA - Build 1 Version 6

Displayed application version: b1v6
ZIP/build version: 4

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

Version 5 change: SystemLookupCodes management was moved from the main screen to the screen opened by the gear icon. The prior "To be implemented." message was removed.

Version 6 UI changes:
- SLC entry fields are arranged in two rows: Group Code + Order, then Value Code + Value.
- Group Code, Order, and Value Code inputs are 1/5 the previous width; Value is 4/5 the previous width.
- Saved SLC list has a small radio-button selection column with no header.
- Group Code and Value Code headers use two lines within their cells.
