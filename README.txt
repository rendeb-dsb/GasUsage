Gas Usage PWA
Displayed application version: b1v38

b1v38 changes:
- Added a "Show Car:" drop-down to the Purchases screen.
  - First entry is All with hidden value -1 and is the default.
  - Remaining entries come from SystemLookupCodes where GroupCode = CR.
  - Hidden value is SLCId.
- Added a "Stations:" drop-down to the right of Show Car.
  - First entry is All with hidden value -1 and is the default.
  - Remaining entries come from SystemLookupCodes where GroupCode = BR.
  - Hidden value is SLCId.
  - Entries are sorted by the SystemLookupCodes Order field.
- The two filters update the Purchases list when changed.
- The Stations filter uses the selected BR SLCId to show purchases made at Stations having that Brand.
- Existing database remains GasUsageDB and is not cleared by this change.


b1v38 changes:
- Moved the Stations filter to the same line as the Purchases title and right-justified it.
- Moved the Show Car filter to the line below and right-justified it.
- Existing filter data sources and filtering logic are unchanged.
