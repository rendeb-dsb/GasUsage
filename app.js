const DB_NAME = "GasUsageDB";
const DB_VERSION = 5;
const STORE_NAME = "SystemLookupCodes";

let db = null;
let dbPromise = null;
let editingId = null;

async function getDatabase() {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = openDatabase().catch(err => { dbPromise = null; db = null; throw err; });
  }
  return dbPromise;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const tx = event.target.transaction;

      // Create missing stores only. Existing stores and records are never cleared.
      let store;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        store = database.createObjectStore(STORE_NAME, { keyPath: "SLCId", autoIncrement: true });
      } else {
        store = tx.objectStore(STORE_NAME);
      }
      if (!store.indexNames.contains("GroupCode")) {
        store.createIndex("GroupCode", "GroupCode", { unique: false });
      }
      if (!store.indexNames.contains("GroupCode_Order")) {
        store.createIndex("GroupCode_Order", ["GroupCode", "Order"], { unique: true });
      }

      let stations;
      if (!database.objectStoreNames.contains("Stations")) {
        stations = database.createObjectStore("Stations", { keyPath: "StationId", autoIncrement: true });
      } else {
        stations = tx.objectStore("Stations");
      }
      if (!stations.indexNames.contains("Name")) stations.createIndex("Name", "Name", { unique: true });
      if (!stations.indexNames.contains("Brand")) stations.createIndex("Brand", "Brand", { unique: false });

      let purchases;
      if (!database.objectStoreNames.contains("Purchases")) {
        purchases = database.createObjectStore("Purchases", { keyPath: "PurchaseId", autoIncrement: true });
      } else {
        purchases = tx.objectStore("Purchases");
      }
      if (!purchases.indexNames.contains("PurchaseDate")) purchases.createIndex("PurchaseDate", "PurchaseDate", { unique: false });
      if (!purchases.indexNames.contains("Station")) purchases.createIndex("Station", "Station", { unique: false });
      if (!purchases.indexNames.contains("Car")) purchases.createIndex("Car", "Car", { unique: false });
      if (!purchases.indexNames.contains("Station_Date_Gallons")) {
        purchases.createIndex("Station_Date_Gallons", ["Station", "PurchaseDate", "Gallons"], { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      db.onversionchange = () => { try { db.close(); } catch (_) {} db = null; dbPromise = null; };
      db.onclose = () => { db = null; dbPromise = null; };
      resolve(db);
    };
    request.onblocked = () => reject(new Error("The existing Gas Usage database is busy."));
    request.onerror = () => reject(request.error || new Error("Unable to open Gas Usage database."));
  });
}

function showMessage(text, type = "") {
  const el = document.getElementById("message");
  el.textContent = text;
  el.className = "message " + type;
}

const operationModal = document.getElementById("operationModal");
const operationModalMessage = document.getElementById("operationModalMessage");
const operationModalOk = document.getElementById("operationModalOk");

function showOperationModal(text) {
  operationModalMessage.textContent = text;
  operationModal.classList.remove("hidden");
  operationModalOk.focus();
}

operationModalOk.addEventListener("click", () => {
  operationModal.classList.add("hidden");
});

function clearEntryFields(focusGroup = false) {
  document.getElementById("slcForm").reset();
  editingId = null;
  showMessage("");
  if (focusGroup) document.getElementById("groupCode").focus();
}

function validate(groupCode, order, valueCode, value) {
  if (!/^[A-Z]{2}$/.test(groupCode))
    return "Group Code must be exactly 2 uppercase letters.";
  if (!Number.isInteger(order) || order < 1)
    return "Order must be a whole number of 1 or greater.";
  if (!/^[A-Z]{2}$/.test(valueCode))
    return "Value Code must be exactly 2 uppercase letters.";
  if (!value)
    return "Value is required.";
  return "";
}

async function saveRecord(record, id = null) {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    let settled = false;
    try {
      const tx = database.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const data = id === null ? record : { ...record, SLCId: id };
      const request = id === null ? store.add(data) : store.put(data);
      request.onerror = () => { if (!settled) { settled = true; reject(request.error || new Error("IndexedDB save request failed.")); } };
      tx.onerror = () => { if (!settled) { settled = true; reject(tx.error || new Error("IndexedDB save transaction failed.")); } };
      tx.onabort = () => { if (!settled) { settled = true; reject(tx.error || new Error("IndexedDB save transaction was aborted.")); } };
      tx.oncomplete = () => { if (!settled) { settled = true; resolve(request.result); } };
    } catch (err) { reject(err); }
  });
}

async function deleteRecord(id) {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const request = tx.objectStore(STORE_NAME).delete(id);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB delete transaction failed."));
    tx.oncomplete = () => resolve();
  });
}

async function getRecord(id) {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllRecords() {
  const database = await getDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function renderRows(selectedId = null) {
  const rows = await getAllRecords();
  rows.sort((a, b) =>
    a.GroupCode.localeCompare(b.GroupCode) ||
    a.Order - b.Order ||
    a.SLCId - b.SLCId
  );

  const tbody = document.getElementById("slcRows");
  tbody.innerHTML = "";

  for (const row of rows) {
    const tr = document.createElement("tr");

    const radioTd = document.createElement("td");
    radioTd.className = "radio-column";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "selectedSLC";
    radio.value = String(row.SLCId);
    radio.setAttribute("aria-label", "Select SLC " + row.SLCId);
    if (selectedId !== null && Number(selectedId) === row.SLCId) radio.checked = true;
    radioTd.appendChild(radio);
    tr.appendChild(radioTd);

    [row.SLCId, row.GroupCode, row.Order, row.ValueCode, row.Value]
      .forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });

    tbody.appendChild(tr);
  }
}

function selectedId() {
  const selected = document.querySelector('input[name="selectedSLC"]:checked');
  return selected ? Number(selected.value) : null;
}

function openDeletePrompt() {
  document.getElementById("deleteModal").classList.remove("hidden");
  document.getElementById("deleteYes").focus();
}

function closeDeletePrompt() {
  document.getElementById("deleteModal").classList.add("hidden");
}

document.getElementById("slcForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const groupCode = document.getElementById("groupCode").value.trim().toUpperCase();
  const order = Number(document.getElementById("order").value);
  const valueCode = document.getElementById("valueCode").value.trim().toUpperCase();
  const value = document.getElementById("value").value;

  const error = validate(groupCode, order, valueCode, value);
  if (error) {
    showMessage(error, "error");
    return;
  }

  try {
    const idBeingEdited = editingId;
    await saveRecord({ GroupCode: groupCode, Order: order, ValueCode: valueCode, Value: value }, idBeingEdited);
    showMessage(idBeingEdited === null ? "Record saved." : "Record updated.", "ok");
    await renderRows(idBeingEdited);
    document.getElementById("slcForm").reset();
    editingId = null;

    // Keep the updated record selected, then clear the entry fields.
    const radio = document.querySelector(
      `input[name="selectedSLC"][value="${idBeingEdited}"]`
    );
    if (radio) radio.checked = true;
  } catch (err) {
    if (err && err.name === "ConstraintError") {
      // A constraint error means a matching key already exists. Refresh the list
      // immediately so an existing record cannot appear to have disappeared.
      try { await renderRows(); } catch (_) {}
      showMessage("That Order is already used within this Group Code.", "error");
    } else {
      const detail = err && err.message ? err.message : "IndexedDB save failed.";
      showMessage("Gas Usage: " + detail, "error");
    }
  }
});

document.getElementById("clearButton").addEventListener("click", () => {
  clearEntryFields(false);
});

document.getElementById("addButton").addEventListener("click", () => {
  clearEntryFields(true);
});

document.getElementById("deleteButton").addEventListener("click", () => {
  if (selectedId() === null) {
    showMessage("Please select a row to delete.", "error");
    return;
  }
  openDeletePrompt();
});

document.getElementById("deleteYes").addEventListener("click", async () => {
  const id = selectedId();
  closeDeletePrompt();
  if (id === null) return;

  try {
    await deleteRecord(id);
    clearEntryFields(false);
    await renderRows();
  } catch {
    showMessage("The record could not be deleted.", "error");
  }
});

document.getElementById("deleteNo").addEventListener("click", () => {
  closeDeletePrompt();
  showMessage("");
});

document.getElementById("changeButton").addEventListener("click", async () => {
  const id = selectedId();
  if (id === null) {
    showMessage("Please select a row to change.", "error");
    return;
  }

  const row = await getRecord(id);
  if (!row) {
    showMessage("The selected record could not be found.", "error");
    return;
  }

  document.getElementById("groupCode").value = row.GroupCode;
  document.getElementById("order").value = row.Order;
  document.getElementById("valueCode").value = row.ValueCode;
  document.getElementById("value").value = row.Value;
  editingId = row.SLCId;
  showMessage("Change the data, then press Save.", "ok");
  document.getElementById("groupCode").focus();
});

document.querySelectorAll("#groupCode, #valueCode").forEach(input => {
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  });
});

// Value deliberately accepts mixed case and has no length limit.

document.getElementById("gearButton").addEventListener("click", async () => {
  document.getElementById("mainScreen").classList.add("hidden");
  document.getElementById("stationsScreen").classList.add("hidden");
  document.getElementById("stationFormScreen").classList.add("hidden");
  document.getElementById("purchasesScreen").classList.add("hidden");
  document.getElementById("purchaseFormScreen").classList.add("hidden");
  document.getElementById("gearScreen").classList.remove("hidden");
  showMessage("");
  try {
    await getDatabase();
    await renderRows();
  } catch (err) {
    showMessage(err && err.message ? err.message : "Unable to load System Lookup Codes.", "error");
  }
  document.getElementById("groupCode").focus();
});

document.getElementById("closeGear").addEventListener("click", () => {
  document.getElementById("gearScreen").classList.add("hidden");
  if (activeArea === "stations") document.getElementById("stationsScreen").classList.remove("hidden");
  else if (activeArea === "purchases") document.getElementById("purchasesScreen").classList.remove("hidden");
  else document.getElementById("mainScreen").classList.remove("hidden");
});

const actionsButton = document.getElementById("actionsButton");
const actionsMenu = document.getElementById("actionsMenu");
const importButton = document.getElementById("importButton");
const exportButton = document.getElementById("exportButton");
const jsonFileInput = document.getElementById("jsonFileInput");

actionsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const hidden = actionsMenu.classList.toggle("hidden");
  actionsButton.setAttribute("aria-expanded", String(!hidden));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".menu-area")) {
    actionsMenu.classList.add("hidden");
    actionsButton.setAttribute("aria-expanded", "false");
  }
});

exportButton.addEventListener("click", async () => {
  actionsMenu.classList.add("hidden");
  actionsButton.setAttribute("aria-expanded", "false");

  try {
    const [slc, stations, purchases] = await Promise.all([
      getAllRecords(), getAllStations(), getAllPurchases()
    ]);
    slc.sort((a, b) => a.SLCId - b.SLCId);
    stations.sort((a, b) => a.StationId - b.StationId);
    purchases.sort((a, b) => a.PurchaseId - b.PurchaseId);

    const payload = {
      application: "Gas Usage",
      database: DB_NAME,
      format: "GasUsage-full-database",
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {
        SystemLookupCodes: slc,
        Stations: stations,
        Purchases: purchases
      }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "GasUsage.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showOperationModal("The Gas Usage database was exported successfully.");
  } catch {
    showMessage("The Gas Usage database could not be exported.", "error");
  }
});

importButton.addEventListener("click", () => {
  actionsMenu.classList.add("hidden");
  actionsButton.setAttribute("aria-expanded", "false");
  jsonFileInput.value = "";
  jsonFileInput.click();
});

function validateFullImport(payload) {
  if (!payload || typeof payload !== "object" || !payload.tables) {
    throw new Error("The JSON file is not a complete Gas Usage database export.");
  }

  const tables = payload.tables;
  const slc = Array.isArray(tables.SystemLookupCodes) ? tables.SystemLookupCodes : null;
  const stations = Array.isArray(tables.Stations) ? tables.Stations : null;
  const purchases = Array.isArray(tables.Purchases) ? tables.Purchases : null;
  if (!slc || !stations || !purchases) {
    throw new Error("The JSON file must contain SystemLookupCodes, Stations, and Purchases.");
  }

  const slcIds = new Set();
  const groupOrders = new Set();
  const slcById = new Map();
  const normalizedSLC = slc.map(row => {
    const SLCId = Number(row.SLCId), Order = Number(row.Order);
    const GroupCode = String(row.GroupCode ?? "").trim().toUpperCase();
    const ValueCode = String(row.ValueCode ?? "").trim().toUpperCase();
    const Value = String(row.Value ?? "");
    if (!Number.isInteger(SLCId) || SLCId < 1) throw new Error("Invalid SLCId.");
    if (!/^[A-Z]{2}$/.test(GroupCode)) throw new Error("Invalid GroupCode.");
    if (!Number.isInteger(Order) || Order < 1) throw new Error("Invalid Order.");
    if (!/^[A-Z]{2}$/.test(ValueCode)) throw new Error("Invalid ValueCode.");
    if (!Value) throw new Error("Value is required.");
    if (slcIds.has(SLCId)) throw new Error("Duplicate SLCId.");
    const key = GroupCode + "\u0000" + Order;
    if (groupOrders.has(key)) throw new Error("Duplicate GroupCode + Order.");
    slcIds.add(SLCId); groupOrders.add(key);
    const out = {SLCId, GroupCode, Order, ValueCode, Value};
    slcById.set(SLCId, out);
    return out;
  });

  const stationIds = new Set();
  const stationNames = new Set();
  const normalizedStations = stations.map(row => {
    const StationId = Number(row.StationId);
    const Name = String(row.Name ?? "").trim();
    const Brand = Number(row.Brand);
    const Address1 = String(row.Address1 ?? "").trim();
    const Address2 = String(row.Address2 ?? "").trim();
    const City = String(row.City ?? "").trim();
    const State = String(row.State ?? "").trim().toUpperCase();
    const Zip = String(row.Zip ?? "").trim();
    if (!Number.isInteger(StationId) || StationId < 1) throw new Error("Invalid StationId.");
    if (Name.length < 1) throw new Error("Station Name is required.");
    if (stationIds.has(StationId)) throw new Error("Duplicate StationId.");
    if (stationNames.has(Name)) throw new Error("Duplicate Station Name.");
    if (!slcById.has(Brand) || slcById.get(Brand).GroupCode !== "BR") throw new Error("Invalid Station Brand reference.");
    if (!Address1) throw new Error("Station Address1 is required.");
    if (!City) throw new Error("Station City is required.");
    if (!/^[A-Z]{2}$/.test(State)) throw new Error("Invalid Station State.");
    if (!/^\d{5}$/.test(Zip)) throw new Error("Invalid Station Zip.");
    stationIds.add(StationId); stationNames.add(Name);
    return {StationId, Name, Brand, Address1, Address2, City, State, Zip};
  });

  const purchaseIds = new Set();
  const normalizedPurchases = purchases.map(row => {
    const PurchaseId = Number(row.PurchaseId);
    const PurchaseDate = String(row.PurchaseDate ?? "");
    const Station = Number(row.Station);
    const Car = Number(row.Car);
    const Gallons = Number(Number(row.Gallons).toFixed(3));
    const Price = Number(Number(row.Price).toFixed(3));
    const Cost = Number(Number(row.Cost).toFixed(2));
    if (!Number.isInteger(PurchaseId) || PurchaseId < 1) throw new Error("Invalid PurchaseId.");
    if (purchaseIds.has(PurchaseId)) throw new Error("Duplicate PurchaseId.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(PurchaseDate)) throw new Error("Invalid Purchase Date.");
    if (!stationIds.has(Station)) throw new Error("Invalid Purchase Station reference.");
    if (!slcById.has(Car) || slcById.get(Car).GroupCode !== "CR") throw new Error("Invalid Purchase Car reference.");
    if (!Number.isFinite(Gallons) || Gallons <= 0 || Gallons > 50) throw new Error("Invalid Gallons value.");
    if (!Number.isFinite(Price) || Price <= 0 || Price > 10) throw new Error("Invalid Price value.");
    if (!Number.isFinite(Cost) || Cost < 0 || Cost > 99) throw new Error("Invalid Cost value.");
    purchaseIds.add(PurchaseId);
    return {PurchaseId, PurchaseDate, Station, Car, Gallons, Price, Cost};
  });

  return {SystemLookupCodes: normalizedSLC, Stations: normalizedStations, Purchases: normalizedPurchases};
}

jsonFileInput.addEventListener("change", async () => {
  const file = jsonFileInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const tables = validateFullImport(payload);
    const confirmed = window.confirm("Import this Gas Usage database and replace all current data in all three tables?");
    if (!confirmed) return;

    const database = await getDatabase();
    const tx = database.transaction(["SystemLookupCodes", "Stations", "Purchases"], "readwrite");
    const slcStore = tx.objectStore("SystemLookupCodes");
    const stationStore = tx.objectStore("Stations");
    const purchaseStore = tx.objectStore("Purchases");
    slcStore.clear(); stationStore.clear(); purchaseStore.clear();
    for (const row of tables.SystemLookupCodes) slcStore.put(row);
    for (const row of tables.Stations) stationStore.put(row);
    for (const row of tables.Purchases) purchaseStore.put(row);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Import aborted."));
    });

    editingId = null;
    editingStationId = null;
    editingPurchaseId = null;
    await renderRows();
    if (activeArea === "stations") await renderStations();
    if (activeArea === "purchases") await renderPurchases();
    showMessage("");
    showOperationModal("The Gas Usage database was imported successfully.");
  } catch (err) {
    showMessage("The Gas Usage database could not be imported: " + err.message, "error");
  } finally {
    jsonFileInput.value = "";
  }
});



// b1v22 Stations UI and data handling.
let activeArea = "main";
let editingStationId = null;

function hidePrimaryScreens() {
  ["mainScreen", "stationsScreen", "stationFormScreen", "purchasesScreen", "purchaseFormScreen", "gearScreen"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
}

function closeActionsMenu() {
  actionsMenu.classList.add("hidden");
  actionsButton.setAttribute("aria-expanded", "false");
}

function stationMessage(text, type="") {
  const el=document.getElementById("stationListMessage");
  el.textContent=text; el.className="message "+type;
}
function stationFormMessage(text, type="") {
  const el=document.getElementById("stationFormMessage");
  el.textContent=text; el.className="message "+type;
}

async function getAllStations() {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    const r=database.transaction("Stations","readonly").objectStore("Stations").getAll();
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function getStation(id) {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    const r=database.transaction("Stations","readonly").objectStore("Stations").get(id);
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function saveStation(record,id=null) {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction("Stations","readwrite"), st=tx.objectStore("Stations");
    const r=id===null?st.add(record):st.put({...record,StationId:id});
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function removeStation(id) {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    const r=database.transaction("Stations","readwrite").objectStore("Stations").delete(id);
    r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error);
  });
}
function getBrandCodes() {
  return getAllRecords().then(rows=>rows.filter(r=>r.GroupCode==="BR").sort((a,b)=>a.Order-b.Order));
}
function getCarCodes() {
  return getAllRecords().then(rows=>rows.filter(r=>r.GroupCode==="CR").sort((a,b)=>a.Order-b.Order));
}

async function renderStations(selected=null) {
  const [rows,brands]=await Promise.all([getAllStations(),getBrandCodes()]);
  const brandMap=new Map(brands.map(b=>[b.SLCId,b.Value]));
  rows.sort((a,b)=>a.Name.localeCompare(b.Name));
  const body=document.getElementById("stationRows"); body.innerHTML="";
  for(const row of rows){
    const tr=document.createElement("tr");
    const td0=document.createElement("td"); td0.className="radio-column";
    const radio=document.createElement("input"); radio.type="radio"; radio.name="selectedStation"; radio.value=row.StationId;
    if(selected===row.StationId) radio.checked=true; td0.appendChild(radio); tr.appendChild(td0);
    const address=row.Address2?`${row.Address1}, ${row.Address2}`:row.Address1;
    [row.Name,brandMap.get(row.Brand)||"",address,row.City,row.State,row.Zip].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td)});
    body.appendChild(tr);
  }
}
function selectedStationId(){const r=document.querySelector('input[name="selectedStation"]:checked');return r?Number(r.value):null;}

async function showStations(){
  hidePrimaryScreens(); document.getElementById("stationsScreen").classList.remove("hidden");
  activeArea="stations"; document.getElementById("stationsButton").classList.add("active"); document.getElementById("purchasesButton").classList.remove("active");
  stationMessage(""); await renderStations();
}
async function loadBrandOptions(selected=null){
  const select=document.getElementById("stationBrand"), brands=await getBrandCodes(); select.innerHTML="";
  const blank=document.createElement("option"); blank.value=""; blank.textContent="Select brand"; select.appendChild(blank);
  brands.forEach(b=>{const o=document.createElement("option");o.value=b.SLCId;o.textContent=b.Value;if(selected===b.SLCId)o.selected=true;select.appendChild(o)});
}
async function showStationForm(mode,row=null){
  hidePrimaryScreens(); document.getElementById("stationFormScreen").classList.remove("hidden");
  document.getElementById("stationForm").reset(); document.getElementById("stationState").value="FL"; stationFormMessage("");
  editingStationId=mode==="change"&&row?row.StationId:null;
  document.getElementById("stationFormTitle").textContent=mode==="change"?"Change Station":"Add Station";
  await loadBrandOptions(row?row.Brand:null);
  if(row){
    document.getElementById("stationName").value=row.Name; document.getElementById("stationAddress1").value=row.Address1;
    document.getElementById("stationAddress2").value=row.Address2||""; document.getElementById("stationCity").value=row.City;
    document.getElementById("stationState").value=row.State; document.getElementById("stationZip").value=row.Zip;
  }
  document.getElementById("stationName").focus();
}

function validateStation(){
  const rec={
    Name:document.getElementById("stationName").value.trim(), Brand:Number(document.getElementById("stationBrand").value),
    Address1:document.getElementById("stationAddress1").value.trim(), Address2:document.getElementById("stationAddress2").value.trim(),
    City:document.getElementById("stationCity").value.trim(), State:document.getElementById("stationState").value.trim().toUpperCase(),
    Zip:document.getElementById("stationZip").value.trim()
  };
  if(!rec.Name)return [null,"Name is required."]; if(!Number.isInteger(rec.Brand)||rec.Brand<1)return [null,"Brand is required."];
  if(!rec.Address1)return [null,"Address1 is required."]; if(!rec.City)return [null,"City is required."];
  if(!/^[A-Z]{2}$/.test(rec.State))return [null,"State must be exactly 2 uppercase letters."];
  if(!/^\d{5}$/.test(rec.Zip))return [null,"Zip must be exactly 5 digits."];
  return [rec,""];
}

document.getElementById("stationsButton").addEventListener("click",showStations);
document.getElementById("addAction").addEventListener("click",async()=>{closeActionsMenu();if(activeArea==="stations") await showStationForm("add"); else if(activeArea==="purchases") await showPurchaseForm("add");});
document.getElementById("changeAction").addEventListener("click",async()=>{closeActionsMenu();if(activeArea==="stations"){const id=selectedStationId();if(id===null){stationMessage("Please select a station to change.","error");return;}const row=await getStation(id);if(row)await showStationForm("change",row);} else if(activeArea==="purchases"){const id=selectedPurchaseId();if(id===null){document.getElementById("purchaseListMessage").textContent="Please select a purchase to change.";return;}const row=await getPurchase(id);if(row)await showPurchaseForm("change",row);}});
document.getElementById("deleteAction").addEventListener("click",async()=>{closeActionsMenu();if(activeArea==="stations"){const id=selectedStationId();if(id===null){stationMessage("Please select a station to delete.","error");return;}if(confirm("Are you sure that you want to delete this station?")){await removeStation(id);await renderStations();}} else if(activeArea==="purchases"){const id=selectedPurchaseId();if(id===null){document.getElementById("purchaseListMessage").textContent="Please select a purchase to delete.";return;}if(confirm("Are you sure that you want to delete this purchase?")){await removePurchase(id);await renderPurchases();}}});
document.getElementById("stationCancel").addEventListener("click",showStations);
document.getElementById("stationState").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,2));
document.getElementById("stationZip").addEventListener("input",e=>e.target.value=e.target.value.replace(/\D/g,"").slice(0,5));
document.getElementById("stationForm").addEventListener("submit",async e=>{
  e.preventDefault(); const [rec,error]=validateStation(); if(error){stationFormMessage(error,"error");return;}
  try{const id=await saveStation(rec,editingStationId); editingStationId=null; await showStations(); await renderStations(id);}
  catch(err){stationFormMessage(err&&err.name==="ConstraintError"?"Station Name must be unique.":"The station could not be saved.","error");}
});


// b1v22 Purchases UI and data handling.
let editingPurchaseId = null;

async function getAllPurchases() {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    const r=database.transaction("Purchases","readonly").objectStore("Purchases").getAll();
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function getPurchase(id) {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    const r=database.transaction("Purchases","readonly").objectStore("Purchases").get(id);
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function savePurchase(record,id=null) {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    let requestResult;
    let settled = false;
    try {
      const tx=database.transaction("Purchases","readwrite");
      const st=tx.objectStore("Purchases");
      const r=id===null?st.add(record):st.put({...record,PurchaseId:id});
      r.onsuccess=()=>{ requestResult=r.result; };
      r.onerror=()=>{ if(!settled){ settled=true; reject(r.error || new Error("IndexedDB purchase save failed.")); } };
      tx.onerror=()=>{ if(!settled){ settled=true; reject(tx.error || new Error("IndexedDB purchase transaction failed.")); } };
      tx.onabort=()=>{ if(!settled){ settled=true; reject(tx.error || new Error("IndexedDB purchase transaction was aborted.")); } };
      tx.oncomplete=()=>{ if(!settled){ settled=true; resolve(requestResult); } };
    } catch(err) { reject(err); }
  });
}
async function removePurchase(id) {
  const database = await getDatabase();
  return new Promise((resolve,reject)=>{
    const r=database.transaction("Purchases","readwrite").objectStore("Purchases").delete(id);
    r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error);
  });
}
function formatDateDisplay(value) {
  if (!value) return "";
  const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value;
}
function todayMaskedDate() {
  const d=new Date();
  return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/20${String(d.getFullYear()).slice(-2)}`;
}
function maskedDateToISO(v) {
  if (!/^\d{2}\/\d{2}\/20\d{2}$/.test(v)) return null;
  const [mm,dd,yyyy]=v.split("/");
  const y=Number(yyyy), m=Number(mm), d=Number(dd);
  const dt=new Date(y,m-1,d);
  if(dt.getFullYear()!==y || dt.getMonth()!==m-1 || dt.getDate()!==d) return null;
  return `${yyyy}-${mm}-${dd}`;
}
function setMaskedDateValue(raw) {
  const digits=String(raw||"").replace(/\D/g,"").slice(0,6);
  const chars=Array(10).fill(" ");
  // Fixed separators and fixed century.
  chars[2]="/"; chars[5]="/"; chars[6]="2"; chars[7]="0";
  [0,1,3,4,8,9].forEach((pos,i)=>{ if(digits[i]) chars[pos]=digits[i]; });
  return chars.join("");
}
function applyDateMask(input) {
  // Keep the mask positions fixed: MM/DD/20YY.
  const digits=input.value.replace(/\D/g,"").slice(0,6);
  input.value=setMaskedDateValue(digits);
}
function previousEditablePosition(pos) {
  const editable=[0,1,3,4,8,9];
  for(let i=editable.length-1;i>=0;i--) if(editable[i] < pos) return editable[i];
  return null;
}
function nextEditablePosition(pos) {
  const editable=[0,1,3,4,8,9];
  for(const p of editable) if(p >= pos) return p;
  return null;
}
function normalizeDateValue(value) {
  const chars=Array(10).fill(" ");
  chars[2]="/"; chars[5]="/"; chars[6]="2"; chars[7]="0";
  const source=String(value||"");
  [0,1,3,4,8,9].forEach(pos=>{
    const ch=source[pos];
    if(/\d/.test(ch||"")) chars[pos]=ch;
  });
  return chars.join("");
}
function setupPurchaseDateMask() {
  const input=document.getElementById("purchaseDate");
  input.value=normalizeDateValue(input.value);

  input.addEventListener("keydown",e=>{
    const editable=[0,1,3,4,8,9];
    const start=input.selectionStart ?? 0;
    const end=input.selectionEnd ?? start;

    if(e.key==="Backspace") {
      e.preventDefault();
      let target=previousEditablePosition(start);
      if(start!==end) {
        for(const p of editable) if(p>=start && p<end) input.value=input.value.slice(0,p)+" "+input.value.slice(p+1);
        input.value=normalizeDateValue(input.value);
        input.setSelectionRange(start,start);
        return;
      }
      if(target!==null) {
        input.value=input.value.slice(0,target)+" "+input.value.slice(target+1);
        input.value=normalizeDateValue(input.value);
        input.setSelectionRange(target,target);
      }
      return;
    }

    if(e.key==="Delete") {
      e.preventDefault();
      let target=nextEditablePosition(start);
      if(start!==end) {
        for(const p of editable) if(p>=start && p<end) input.value=input.value.slice(0,p)+" "+input.value.slice(p+1);
        input.value=normalizeDateValue(input.value);
        input.setSelectionRange(start,start);
        return;
      }
      if(target!==null) {
        input.value=input.value.slice(0,target)+" "+input.value.slice(target+1);
        input.value=normalizeDateValue(input.value);
        input.setSelectionRange(start,start);
      }
      return;
    }

    if(/^\d$/.test(e.key)) {
      e.preventDefault();
      let target=nextEditablePosition(start);
      if(target===null) return;
      input.value=input.value.slice(0,target)+e.key+input.value.slice(target+1);
      input.value=normalizeDateValue(input.value);
      const next=nextEditablePosition(target+1);
      input.setSelectionRange(next===null?10:next,next===null?10:next);
    }
  });

  input.addEventListener("click",()=>{
    const pos=input.selectionStart ?? 0;
    const next=nextEditablePosition(pos);
    if(pos===2 || pos===5 || pos===6 || pos===7) {
      const p=next===null?10:next; input.setSelectionRange(p,p);
    }
  });

  input.addEventListener("focus",()=>{
    input.value=normalizeDateValue(input.value);
  });
}

function stationNameMap(rows){return new Map(rows.map(s=>[s.StationId,s.Name]));}
async function loadPurchaseFilters(selectedCar="-1", selectedStationBrand="-1") {
  const [cars, brands] = await Promise.all([getCarCodes(), getBrandCodes()]);
  const carSelect = document.getElementById("showCarFilter");
  const stationSelect = document.getElementById("stationFilter");
  if (!carSelect || !stationSelect) return;

  carSelect.innerHTML = "";
  stationSelect.innerHTML = "";

  const allCar = document.createElement("option");
  allCar.value = "-1";
  allCar.textContent = "All";
  allCar.selected = String(selectedCar) === "-1";
  carSelect.appendChild(allCar);
  cars.sort((a,b) => a.Order - b.Order || a.SLCId - b.SLCId).forEach(row => {
    const option = document.createElement("option");
    option.value = String(row.SLCId);
    option.textContent = row.Value;
    option.selected = String(selectedCar) === String(row.SLCId);
    carSelect.appendChild(option);
  });

  const allStation = document.createElement("option");
  allStation.value = "-1";
  allStation.textContent = "All";
  allStation.selected = String(selectedStationBrand) === "-1";
  stationSelect.appendChild(allStation);
  brands.sort((a,b) => a.Order - b.Order || a.SLCId - b.SLCId).forEach(row => {
    const option = document.createElement("option");
    option.value = String(row.SLCId);
    option.textContent = row.Value;
    option.selected = String(selectedStationBrand) === String(row.SLCId);
    stationSelect.appendChild(option);
  });
}

async function renderPurchases(selected=null) {
  const [rows,stations,cars]=await Promise.all([getAllPurchases(),getAllStations(),getCarCodes()]);
  const sm=stationNameMap(stations);
  const cm=new Map(cars.map(c=>[c.SLCId,c.Value]));
  const selectedCar=document.getElementById("showCarFilter")?.value ?? "-1";
  const selectedStationBrand=document.getElementById("stationFilter")?.value ?? "-1";
  const stationMap=new Map(stations.map(s=>[s.StationId,s]));

  const filtered=rows.filter(row=>{
    if(selectedCar!=="-1" && Number(row.Car)!==Number(selectedCar)) return false;
    if(selectedStationBrand!=="-1") {
      const station=stationMap.get(Number(row.Station));
      if(!station || Number(station.Brand)!==Number(selectedStationBrand)) return false;
    }
    return true;
  });

  filtered.sort((a,b)=>String(b.PurchaseDate).localeCompare(String(a.PurchaseDate)) || b.PurchaseId-a.PurchaseId);
  const body=document.getElementById("purchaseRows"); body.innerHTML="";
  for(const row of filtered){
    const tr=document.createElement("tr");
    const td0=document.createElement("td"); td0.className="radio-column";
    const radio=document.createElement("input"); radio.type="radio"; radio.name="selectedPurchase"; radio.value=row.PurchaseId;
    if(selected!==null && Number(selected)===row.PurchaseId) radio.checked=true;
    td0.appendChild(radio); tr.appendChild(td0);
    [sm.get(row.Station)||"", cm.get(row.Car)||"", formatDateDisplay(row.PurchaseDate), Number(row.Gallons).toFixed(3), Number(row.Price).toFixed(3), Number(row.Cost).toFixed(2)].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td)});
    body.appendChild(tr);
  }
}
function selectedPurchaseId(){const r=document.querySelector('input[name="selectedPurchase"]:checked');return r?Number(r.value):null;}
async function loadPurchaseOptions(selectedStation=null,selectedCar=null){
  const [stations,cars]=await Promise.all([getAllStations(),getCarCodes()]);
  const ss=document.getElementById("purchaseStation"), cs=document.getElementById("purchaseCar");
  ss.innerHTML=""; cs.innerHTML="";

  let o=document.createElement("option");
  o.value=""; o.textContent="Select station"; ss.appendChild(o);
  stations.sort((a,b)=>a.Name.localeCompare(b.Name)).forEach(x=>{
    const q=document.createElement("option");
    q.value=x.StationId; q.textContent=x.Name;
    if(Number(selectedStation)===x.StationId) q.selected=true;
    ss.appendChild(q);
  });

  // Cars come only from SystemLookupCodes where GroupCode is CR.
  // For Add, default to the first returned CR row.
  cars.forEach((x,i)=>{
    const q=document.createElement("option");
    q.value=x.SLCId; q.textContent=x.Value;
    if(selectedCar !== null && Number(selectedCar)===x.SLCId) q.selected=true;
    else if(selectedCar === null && i===0) q.selected=true;
    cs.appendChild(q);
  });
}

async function showPurchases(){
  hidePrimaryScreens(); document.getElementById("purchasesScreen").classList.remove("hidden"); activeArea="purchases";
  document.getElementById("stationsButton").classList.remove("active"); document.getElementById("purchasesButton").classList.add("active");
  document.getElementById("purchaseListMessage").textContent="";
  const selectedCar=document.getElementById("showCarFilter")?.value || "-1";
  const selectedStationBrand=document.getElementById("stationFilter")?.value || "-1";
  await loadPurchaseFilters(selectedCar, selectedStationBrand);
  await renderPurchases();
}
let purchaseCostCalculated = false;

function setCalculatedCost(value) {
  const costInput = document.getElementById("purchaseCost");
  costInput.value = Number(value).toFixed(2);
  costInput.classList.add("calculated-cost");
  costInput.classList.remove("user-cost");
  costInput.style.color = "#176b2c";
  purchaseCostCalculated = true;
}

function clearCalculatedCostState() {
  const costInput = document.getElementById("purchaseCost");
  costInput.classList.remove("calculated-cost");
  costInput.classList.add("user-cost");
  costInput.style.color = "#111";
  purchaseCostCalculated = false;
}

function calculatePurchaseCostIfReady() {
  const gallonsInput = document.getElementById("purchaseGallons");
  const priceInput = document.getElementById("purchasePrice");
  const costInput = document.getElementById("purchaseCost");
  if (!gallonsInput || !priceInput || !costInput) return false;
  const gallonsText = gallonsInput.value.trim();
  const priceText = priceInput.value.trim();
  if (!gallonsText || !priceText) return false;
  const gallons = Number(gallonsText);
  const price = Number(priceText);
  if (!Number.isFinite(gallons) || gallons <= 0 || gallons > 50 ||
      !Number.isFinite(price) || price <= 0 || price > 10) return false;
  setCalculatedCost(gallons * price);
  return true;
}

window.gasUsageRecalcCost = function() {
  const gallonsInput = document.getElementById("purchaseGallons");
  const priceInput = document.getElementById("purchasePrice");
  const costInput = document.getElementById("purchaseCost");
  if (!gallonsInput || !priceInput || !costInput) return;
  const gallons = Number(gallonsInput.value);
  const price = Number(priceInput.value);
  if (Number.isFinite(gallons) && gallons > 0 && gallons <= 50 && Number.isFinite(price) && price > 0 && price <= 10) {
    setCalculatedCost(gallons * price);
  }
};

function setupPurchaseCostCalculation() {
  const gallonsInput = document.getElementById("purchaseGallons");
  const priceInput = document.getElementById("purchasePrice");
  const costInput = document.getElementById("purchaseCost");
  if (!gallonsInput || !priceInput || !costInput) return;

  const recalculate = () => { calculatePurchaseCostIfReady(); };
  [gallonsInput, priceInput].forEach(input => {
    input.addEventListener("input", recalculate);
    input.addEventListener("change", recalculate);
    input.addEventListener("blur", recalculate);
  });

  costInput.addEventListener("focus", () => {
    if (purchaseCostCalculated) costInput.select();
  });
  costInput.addEventListener("input", () => {
    clearCalculatedCostState();
  });
}

async function showPurchaseForm(mode,row=null){
  hidePrimaryScreens(); document.getElementById("purchaseFormScreen").classList.remove("hidden");
  document.getElementById("purchaseForm").reset(); editingPurchaseId=mode==="change"&&row?row.PurchaseId:null;
  purchaseCostCalculated=false;
  const costInput=document.getElementById("purchaseCost");
  costInput.classList.remove("calculated-cost","user-cost");
  costInput.style.color = "#111";
  document.getElementById("purchaseFormTitle").textContent=mode==="change"?"Change Purchase":"Add Purchase";
  await loadPurchaseOptions(row?row.Station:null,row?row.Car:null);
  document.getElementById("purchaseDate").value=normalizeDateValue(row?formatDateDisplay(row.PurchaseDate):todayMaskedDate());
  if(row){
    document.getElementById("purchaseGallons").value=Number(row.Gallons).toFixed(3);
    document.getElementById("purchasePrice").value=Number(row.Price).toFixed(3);
    costInput.value=Number(row.Cost).toFixed(2);
    costInput.classList.add("user-cost");
    costInput.style.color = "#111";
  } else {
    // Add mode: leave Cost blank until Gallons and Price are entered.
    costInput.value = "";
  }
  calculatePurchaseCostIfReady();
  document.getElementById("purchaseFormMessage").textContent=""; document.getElementById("purchaseStation").focus();
}
function showGasPurchaseMessage(message) {
  const modal = document.getElementById("gasPurchaseModal");
  document.getElementById("gasPurchaseModalMessage").textContent = message;
  modal.classList.remove("hidden");
  document.getElementById("gasPurchaseModalOk").focus();
}

function hideGasPurchaseMessage() {
  document.getElementById("gasPurchaseModal").classList.add("hidden");
}

async function isDuplicatePurchase(stationId, purchaseDate, gallons, excludeId = null) {
  const [purchases, stations] = await Promise.all([getAllPurchases(), getAllStations()]);
  const station = stations.find(s => s.StationId === stationId);
  const stationName = station ? String(station.Name) : "";
  const targetGallons = Number(Number(gallons).toFixed(3));
  return purchases.some(p => {
    if (excludeId !== null && Number(p.PurchaseId) === Number(excludeId)) return false;
    const pStation = stations.find(s => s.StationId === Number(p.Station));
    return pStation && String(pStation.Name) === stationName
      && String(p.PurchaseDate) === String(purchaseDate)
      && Number(Number(p.Gallons).toFixed(3)) === targetGallons;
  });
}

function validatePurchase(){
  const costInput = document.getElementById("purchaseCost");
  if (purchaseCostCalculated || !costInput.value.trim()) {
    window.gasUsageRecalcCost();
  }
  const date=maskedDateToISO(document.getElementById("purchaseDate").value);
  const station=Number(document.getElementById("purchaseStation").value), car=Number(document.getElementById("purchaseCar").value);
  const gallons=Number(document.getElementById("purchaseGallons").value), price=Number(document.getElementById("purchasePrice").value), cost=Number(document.getElementById("purchaseCost").value);
  if(!date)return [null,"Purchase Date must be a valid date in mm/dd/20yy format."];
  if(!Number.isInteger(station)||station<1)return [null,"Station is required."];
  if(!Number.isInteger(car)||car<1)return [null,"Car is required."];
  if(!Number.isFinite(gallons)||gallons<=0||gallons>50||!/^\d+(\.\d{1,3})?$/.test(document.getElementById("purchaseGallons").value.trim()))return [null,"Gallons must be positive and 50.000 or less."];
  if(!Number.isFinite(price)||price<=0||price>10||!/^\d+(\.\d{1,3})?$/.test(document.getElementById("purchasePrice").value.trim()))return [null,"Price must be positive and 10.000 or less."];
  if(!Number.isFinite(cost)||cost<0||cost>99||!/^\d+(\.\d{1,2})?$/.test(document.getElementById("purchaseCost").value.trim()))return [null,"Cost must be positive and 99.00 or less."];
  return [{PurchaseDate:date,Station:station,Car:car,Gallons:Number(gallons.toFixed(3)),Price:Number(price.toFixed(3)),Cost:Number(cost.toFixed(2))},""];
}

document.getElementById("showCarFilter").addEventListener("change", async () => { await renderPurchases(); });
document.getElementById("stationFilter").addEventListener("change", async () => { await renderPurchases(); });
document.getElementById("purchasesButton").addEventListener("click",showPurchases);
document.getElementById("purchaseCancel").addEventListener("click",showPurchases);
document.getElementById("gasPurchaseModalOk").addEventListener("click",hideGasPurchaseMessage);
document.getElementById("gasPurchaseModal").addEventListener("click",e=>{if(e.target.id==="gasPurchaseModal")hideGasPurchaseMessage();});
document.getElementById("purchaseForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const [rec,error]=validatePurchase();
  if(error){document.getElementById("purchaseFormMessage").textContent=error;return;}
  try{
    if(await isDuplicatePurchase(rec.Station,rec.PurchaseDate,rec.Gallons,editingPurchaseId)){
      showGasPurchaseMessage("This purchase is a duplicate of an existing purchase based on Station Name, Purchase Date, and Gallons.");
      return;
    }
    const id=await savePurchase(rec,editingPurchaseId);
    editingPurchaseId=null;await showPurchases();await renderPurchases(id);
  }catch(err){showGasPurchaseMessage("The purchase could not be saved.");}
});
setupPurchaseDateMask();
setupPurchaseCostCalculation();

getDatabase()
  .then(async database => {
    const required = ["SystemLookupCodes", "Stations", "Purchases"];
    const missing = required.filter(name => !database.objectStoreNames.contains(name));
    if (missing.length) throw new Error("Missing data table: " + missing.join(", "));
    await renderRows();
  })
  .catch(err => showMessage(err && err.message ? err.message : "Unable to open the IndexedDB data store.", "error"));
