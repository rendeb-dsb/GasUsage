const DB_NAME = "GasUsageDB";
const DB_VERSION = 2;
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

      // b1v20: add the Stations table without changing existing SLC data.
      if (!database.objectStoreNames.contains("Stations")) {
        const stations = database.createObjectStore("Stations", {
          keyPath: "StationId",
          autoIncrement: true
        });
        stations.createIndex("Name", "Name", { unique: true });
        stations.createIndex("Brand", "Brand", { unique: false });
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
  document.getElementById("gearScreen").classList.remove("hidden");
  document.getElementById("groupCode").focus();
});

document.getElementById("closeGear").addEventListener("click", () => {
  document.getElementById("gearScreen").classList.add("hidden");
  document.getElementById("mainScreen").classList.remove("hidden");
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

openDatabase()
  .then(renderRows)
  .catch(() => showMessage("Unable to open the IndexedDB data store.", "error"));
