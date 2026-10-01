const DB_NAME = "GasUsageDB";
const DB_VERSION = 3;
const STORE_NAME = "SystemLookupCodes";

let db;
let editingId = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "SLCId",
          autoIncrement: true
        });
        store.createIndex("GroupCode", "GroupCode", { unique: false });
        store.createIndex("GroupCode_Order", ["GroupCode", "Order"], { unique: true });
      }

      // b1v22: add the Stations table without changing existing SLC data.
      if (!database.objectStoreNames.contains("Stations")) {
        const stations = database.createObjectStore("Stations", {
          keyPath: "StationId",
          autoIncrement: true
        });
        stations.createIndex("Name", "Name", { unique: true });
        stations.createIndex("Brand", "Brand", { unique: false });
      }

      // b1v22: add the Purchases table without changing existing data.
      if (!database.objectStoreNames.contains("Purchases")) {
        const purchases = database.createObjectStore("Purchases", {
          keyPath: "PurchaseId",
          autoIncrement: true
        });
        purchases.createIndex("PurchaseDate", "PurchaseDate", { unique: false });
        purchases.createIndex("Station", "Station", { unique: false });
        purchases.createIndex("Car", "Car", { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function showMessage(text, type = "") {
  const el = document.getElementById("message");
  el.textContent = text;
  el.className = "message " + type;
}

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

function saveRecord(record, id = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = id === null
      ? store.add(record)
      : store.put({ ...record, SLCId: id });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const request = tx.objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getRecord(id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME).getAll();
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
      showMessage("That Order is already used within this Group Code.", "error");
    } else {
      showMessage("The record could not be saved.", "error");
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

document.getElementById("gearButton").addEventListener("click", () => {
  document.getElementById("mainScreen").classList.add("hidden");
  document.getElementById("stationsScreen").classList.add("hidden");
  document.getElementById("stationFormScreen").classList.add("hidden");
  document.getElementById("purchasesScreen").classList.add("hidden");
  document.getElementById("purchaseFormScreen").classList.add("hidden");
  document.getElementById("gearScreen").classList.remove("hidden");
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
    const rows = await getAllRecords();
    rows.sort((a, b) => a.SLCId - b.SLCId);

    const payload = {
      application: "Gas Usage",
      table: "SystemLookupCodes",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: rows
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "SystemLookupCodes.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    showMessage("The JSON file could not be exported.", "error");
  }
});

importButton.addEventListener("click", () => {
  actionsMenu.classList.add("hidden");
  actionsButton.setAttribute("aria-expanded", "false");
  jsonFileInput.value = "";
  jsonFileInput.click();
});

jsonFileInput.addEventListener("change", async () => {
  const file = jsonFileInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const records = Array.isArray(payload) ? payload : payload.records;
    if (!Array.isArray(records)) throw new Error("JSON does not contain a records array.");

    const normalized = records.map(row => {
      const slcId = Number(row.SLCId);
      const order = Number(row.Order);
      const groupCode = String(row.GroupCode ?? "").trim().toUpperCase();
      const valueCode = String(row.ValueCode ?? "").trim().toUpperCase();
      const value = String(row.Value ?? "");

      if (!Number.isInteger(slcId) || slcId < 1) throw new Error("Invalid SLCId.");
      if (!/^[A-Z]{2}$/.test(groupCode)) throw new Error("Invalid GroupCode.");
      if (!Number.isInteger(order) || order < 1) throw new Error("Invalid Order.");
      if (!/^[A-Z]{2}$/.test(valueCode)) throw new Error("Invalid ValueCode.");
      if (!value) throw new Error("Value is required.");

      return { SLCId: slcId, GroupCode: groupCode, Order: order, ValueCode: valueCode, Value: value };
    });

    const ids = new Set();
    const groupOrders = new Set();
    for (const row of normalized) {
      if (ids.has(row.SLCId)) throw new Error("Duplicate SLCId.");
      ids.add(row.SLCId);
      const key = row.GroupCode + "\u0000" + row.Order;
      if (groupOrders.has(key)) throw new Error("Duplicate GroupCode + Order.");
      groupOrders.add(key);
    }

    const confirmed = window.confirm
      ? window.confirm("Import this JSON file and replace the current SystemLookupCodes data?")
      : false;
    if (!confirmed) return;

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const row of normalized) store.put(row);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Import aborted."));
    });

    clearEntryFields(false);
    await renderRows();
    showMessage("JSON data imported.", "ok");
  } catch (err) {
    showMessage("The JSON file could not be imported: " + err.message, "error");
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

function getAllStations() {
  return new Promise((resolve,reject)=>{
    const r=db.transaction("Stations","readonly").objectStore("Stations").getAll();
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
function getStation(id) {
  return new Promise((resolve,reject)=>{
    const r=db.transaction("Stations","readonly").objectStore("Stations").get(id);
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
function saveStation(record,id=null) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("Stations","readwrite"), st=tx.objectStore("Stations");
    const r=id===null?st.add(record):st.put({...record,StationId:id});
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
function removeStation(id) {
  return new Promise((resolve,reject)=>{
    const r=db.transaction("Stations","readwrite").objectStore("Stations").delete(id);
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
  activeArea="stations"; document.getElementById("stationsButton").classList.add("active");
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

function getAllPurchases() {
  return new Promise((resolve,reject)=>{
    const r=db.transaction("Purchases","readonly").objectStore("Purchases").getAll();
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
function getPurchase(id) {
  return new Promise((resolve,reject)=>{
    const r=db.transaction("Purchases","readonly").objectStore("Purchases").get(id);
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
function savePurchase(record,id=null) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("Purchases","readwrite"), st=tx.objectStore("Purchases");
    const r=id===null?st.add(record):st.put({...record,PurchaseId:id});
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
function removePurchase(id) {
  return new Promise((resolve,reject)=>{
    const r=db.transaction("Purchases","readwrite").objectStore("Purchases").delete(id);
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
async function renderPurchases(selected=null) {
  const [rows,stations]=await Promise.all([getAllPurchases(),getAllStations()]);
  const sm=stationNameMap(stations);
  rows.sort((a,b)=>String(b.PurchaseDate).localeCompare(String(a.PurchaseDate)) || b.PurchaseId-a.PurchaseId);
  const body=document.getElementById("purchaseRows"); body.innerHTML="";
  for(const row of rows){
    const tr=document.createElement("tr");
    const td0=document.createElement("td"); td0.className="radio-column";
    const radio=document.createElement("input"); radio.type="radio"; radio.name="selectedPurchase"; radio.value=row.PurchaseId;
    if(selected!==null && Number(selected)===row.PurchaseId) radio.checked=true;
    td0.appendChild(radio); tr.appendChild(td0);
    [sm.get(row.Station)||"", formatDateDisplay(row.PurchaseDate), Number(row.Gallons).toFixed(3), Number(row.Price).toFixed(3), Number(row.Cost).toFixed(2)].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td)});
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
  document.getElementById("purchaseListMessage").textContent=""; await renderPurchases();
}
let purchaseCostCalculated = false;

function calculatePurchaseCostIfReady() {
  const gallonsInput = document.getElementById("purchaseGallons");
  const priceInput = document.getElementById("purchasePrice");
  const costInput = document.getElementById("purchaseCost");
  const gallonsText = gallonsInput.value.trim();
  const priceText = priceInput.value.trim();
  if (!gallonsText || !priceText) return;
  const gallons = Number(gallonsText);
  const price = Number(priceText);
  if (!Number.isFinite(gallons) || gallons <= 0 || !Number.isFinite(price) || price <= 0) return;
  costInput.value = (gallons * price).toFixed(2);
  costInput.classList.add("calculated-cost");
  costInput.classList.remove("user-cost");
  purchaseCostCalculated = true;
}

function setupPurchaseCostCalculation() {
  const gallonsInput = document.getElementById("purchaseGallons");
  const priceInput = document.getElementById("purchasePrice");
  const costInput = document.getElementById("purchaseCost");
  [gallonsInput, priceInput].forEach(input => {
    input.addEventListener("input", () => {
      calculatePurchaseCostIfReady();
    });
  });
  costInput.addEventListener("focus", () => {
    // If the displayed value was calculated, select it so the user's first
    // keystroke replaces it rather than appending to it.
    if (purchaseCostCalculated) {
      costInput.select();
    }
  });
  costInput.addEventListener("input", () => {
    purchaseCostCalculated = false;
    costInput.classList.remove("calculated-cost");
    costInput.classList.add("user-cost");
  });
}

async function showPurchaseForm(mode,row=null){
  hidePrimaryScreens(); document.getElementById("purchaseFormScreen").classList.remove("hidden");
  document.getElementById("purchaseForm").reset(); editingPurchaseId=mode==="change"&&row?row.PurchaseId:null;
  purchaseCostCalculated=false;
  const costInput=document.getElementById("purchaseCost");
  costInput.classList.remove("calculated-cost","user-cost");
  document.getElementById("purchaseFormTitle").textContent=mode==="change"?"Change Purchase":"Add Purchase";
  await loadPurchaseOptions(row?row.Station:null,row?row.Car:null);
  document.getElementById("purchaseDate").value=normalizeDateValue(row?formatDateDisplay(row.PurchaseDate):todayMaskedDate());
  if(row){
    document.getElementById("purchaseGallons").value=Number(row.Gallons).toFixed(3);
    document.getElementById("purchasePrice").value=Number(row.Price).toFixed(3);
    costInput.value=Number(row.Cost).toFixed(2);
    costInput.classList.add("user-cost");
  }
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
  }catch(err){document.getElementById("purchaseFormMessage").textContent="The purchase could not be saved.";}
});
setupPurchaseDateMask();
setupPurchaseCostCalculation();

openDatabase()
  .then(renderRows)
  .catch(() => showMessage("Unable to open the IndexedDB data store.", "error"));
