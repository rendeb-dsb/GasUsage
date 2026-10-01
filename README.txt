GasUsage PWA - Build 1 Version 24

Displayed application version: b1v24
ZIP/build version: 24

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


b1v18 layout: all four SLC data-entry boxes share one left edge; each label is immediately followed by its associated box with a 10px gap.


b1v18: Each data-entry box is positioned exactly 10px after its associated label.

b1v18 layout changes:
- Save/Clear moved upward 10px; the three small record buttons remain in place.
- A horizontal separator is placed 8px above the three small record buttons.
- The first five list columns are set to 15px wide; Value remains unchanged.

b1v18 cache/update change:
- index.html explicitly displays b1v18.
- CSS and JavaScript URLs are versioned with ?v=b1v18.
- The PWA start URL uses ?v=b1v18 so the installed app gets a new URL/cache key.

b1v18 corrections:
- Save/Clear moved up exactly 10px without moving the three small record buttons.
- A viewport-width horizontal separator is positioned 8px above the three small record buttons without changing their location.
- SLCId, Group Code, Order, and Value Code list columns are forced to 15px; Value is unchanged.


b1v18: SLCId, Group Code, Order, and Value Code are each 100px wide. Radio and Value columns are unchanged.


b1v24 layout changes:
- The Close button is now below the Saved System Lookup Codes list, left-justified with a 20px left margin and 20px top margin.
- Save/Clear moved upward 15px; all content below those buttons moves upward with them.
- The four SLC list columns remain 50px wide; radio and Value columns are unchanged.

b1v24 Stations table
--------------------
IndexedDB object store: Stations
- StationId: primary key, unique whole number, auto-generated starting at 1
- Name: string, unique station name
- Brand: required reference value containing the SystemLookupCodes SLCId for GroupCode BR
- Address1: required string
- Address2: optional string
- City: required string
- State: 2-character uppercase string; default FL when a Station record is created
- Zip: required 5-character string

The Stations object store is added by the IndexedDB version-2 migration and does not alter existing SystemLookupCodes records.


b1v24 changes:
- Purchase Car dropdown now loads only SystemLookupCodes rows with GroupCode CR.
- The first CR row is selected by default when adding a purchase.
- Purchase entry controls shortened as requested: Date 25px, Station 50px, Car 60px, and Gallons/Price/Cost 60px.
- Purchase Date uses a fixed MM/DD/20YY mask; slash separators and the “20” are not deletable. Backspace deletes the prior editable digit and leaves the cursor in that digit position.


b1v24 cost behavior:
- When both Gallons and Price contain positive numeric values, Cost is calculated as Gallons x Price and displayed to two decimal places in green.
- If the user edits Cost, the calculated value is replaced by the user's value and displayed in black.
- The value displayed in Cost is the value saved regardless of display color.
- Existing saved Cost values on Change are treated as user-entered values.
