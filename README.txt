Gas Usage PWA - b1v40

Displayed application version: b1v40

b1v40 changes:
- Retained the Purchase Cost calculation: Gallons x Price, displayed in green as 99.99 when calculated.
- If the user edits Cost, the displayed value becomes black and the user's value is saved.
- Purchase Save now waits for the IndexedDB transaction to complete before returning success, preventing the Purchase list from rendering before the new record is committed.
- Changed the Purchase filter label from "Stations:" to "Show Stations:".
- Database remains GasUsageDB and existing data is preserved.
