GasUsage PWA - Build 1 Version 16

Displayed application version: b1v16
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


b1v16 layout: all four SLC data-entry boxes share one left edge; each label is immediately followed by its associated box with a 10px gap.


b1v16: Each data-entry box is positioned exactly 10px after its associated label.

b1v16 layout changes:
- Save/Clear moved upward 10px; the three small record buttons remain in place.
- A horizontal separator is placed 8px above the three small record buttons.
- The first five list columns are set to 15px wide; Value remains unchanged.

b1v16 cache/update change:
- index.html explicitly displays b1v16.
- CSS and JavaScript URLs are versioned with ?v=b1v16.
- The PWA start URL uses ?v=b1v16 so the installed app gets a new URL/cache key.

b1v16 corrections:
- Save/Clear moved up exactly 10px without moving the three small record buttons.
- A viewport-width horizontal separator is positioned 8px above the three small record buttons without changing their location.
- SLCId, Group Code, Order, and Value Code list columns are forced to 15px; Value is unchanged.
