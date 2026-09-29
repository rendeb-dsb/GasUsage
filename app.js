const DB_NAME = "GasUsageDB";
const DB_VERSION = 1;
const STORE_NAME = "SystemLookupCodes";

let db;

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
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function saveRecord(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function showMessage(text, type = "") {
  const el = document.getElementById("message");
  el.textContent = text;
  el.className = "message " + type;
}

function validate(groupCode, order, valueCode, value) {
  if (!/^[A-Z]{2}$/.test(groupCode))
    return "Group Code must be exactly 2 uppercase letters.";
  if (!Number.isInteger(order) || order < 1)
    return "Order must be a whole number of 1 or greater.";
  if (!/^[A-Z]{2}$/.test(valueCode))
    return "Value Code must be exactly 2 uppercase letters.";
  if (!value || value.length > 10)
    return "Value is required and may contain no more than 10 characters.";
  return "";
}

async function renderRows() {
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
    [row.SLCId, row.GroupCode, row.Order, row.ValueCode, row.Value]
      .forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
    tbody.appendChild(tr);
  }
}

document.getElementById("slcForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const groupCode = document.getElementById("groupCode").value.trim().toUpperCase();
  const order = Number(document.getElementById("order").value);
  const valueCode = document.getElementById("valueCode").value.trim().toUpperCase();
  const value = document.getElementById("value").value.trim();

  const error = validate(groupCode, order, valueCode, value);
  if (error) {
    showMessage(error, "error");
    return;
  }

  try {
    await saveRecord({ GroupCode: groupCode, Order: order, ValueCode: valueCode, Value: value });
    showMessage("Record saved.", "ok");
    document.getElementById("slcForm").reset();
    document.getElementById("groupCode").focus();
    await renderRows();
  } catch (err) {
    if (err && err.name === "ConstraintError") {
      showMessage("That Order is already used within this Group Code.", "error");
    } else {
      showMessage("The record could not be saved.", "error");
    }
  }
});

document.getElementById("clearButton").addEventListener("click", () => {
  document.getElementById("slcForm").reset();
  showMessage("");
  document.getElementById("groupCode").focus();
});

document.getElementById("gearButton").addEventListener("click", () => {
  document.getElementById("mainScreen").classList.add("hidden");
  document.getElementById("gearScreen").classList.remove("hidden");
});

document.getElementById("closeGear").addEventListener("click", () => {
  document.getElementById("gearScreen").classList.add("hidden");
  document.getElementById("mainScreen").classList.remove("hidden");
});

document.querySelectorAll("#groupCode, #valueCode").forEach(input => {
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  });
});

openDatabase()
  .then(renderRows)
  .catch(() => showMessage("Unable to open the IndexedDB data store.", "error"));
