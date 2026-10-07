Gas Usage PWA - b1v49
 
Displayed application version: b1v49
 
b1v49 changes:
- Purchase saves now use an explicit next PurchaseId and IndexedDB put, avoiding dependence on the auto-increment counter.
- The saved record is read back and all purchase fields are verified before success is reported.
- After a successful Save, the Purchases list is displayed with the saved purchase selected before the success message is shown.
- Cancel from Add/Change Purchase returns to the Purchases screen.
- New JavaScript and CSS filenames force a fresh browser/PWA resource load.
