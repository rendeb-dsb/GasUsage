Gas Usage PWA
Displayed application version: b1v34

b1v34 corrective change:
- The System Lookup Codes screen now reloads its saved-record list every time the gear screen is opened.
- If a Save encounters the unique GroupCode/Order constraint, the saved-record list is refreshed immediately so an existing record is visible instead of appearing to be missing.
- No database stores are cleared by this change.
- Database remains GasUsageDB.
