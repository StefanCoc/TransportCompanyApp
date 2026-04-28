const N8N_WEBHOOK = "http://localhost:5678/webhook/api";
const ITEMS_PER_PAGE = 10;
const ACTIVE_PAGE_DISPLAYS = { faktura: "grid", klijenti: "block", ture: "block", zaposleni: "block" };
let cachedClients = [];
let filteredClients = [];
let cachedTours = [];
let cachedEmployees = [];
let currentPage = { clients: 1, tours: 1, employees: 1 };
let pendingInvoicePayload = null;

function getById(id) {
  return document.getElementById(id);
}

function normalizeListPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.body)) return data.body;
  return [];
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(value) {
  return `${value.toFixed(2)} KM`;
}

function setStatus(message, type = "success") {
  const box = getById("statusMsg");
  if (!box) return;
  if (!message) {
    box.className = "status hidden";
    box.textContent = "";
    return;
  }

  box.textContent = message;
  box.className = `status ${type}`;
}

function resetInvoiceLoadingState() {
  getById("loading")?.classList.add("hidden");
  const faktura = getById("faktura");
  if (faktura) {
    faktura.style.display = ACTIVE_PAGE_DISPLAYS.faktura;
  }
  const submitBtn = getById("submitInvoiceBtn");
  if (submitBtn) {
    submitBtn.disabled = false;
  }
}

async function apiPost(payload) {
  const res = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res;
}

function show(page) {
  const target = getById(page);
  if (!target) {
    setStatus("Tražena sekcija trenutno nije dostupna.", "error");
    return;
  }

  document.querySelectorAll(".page").forEach((el) => {
    el.style.display = "none";
  });
  getById("loading")?.classList.add("hidden");
  target.style.display = ACTIVE_PAGE_DISPLAYS[page] || "block";
}

function otvoriPopup() {
  getById("popupKlijent")?.classList.remove("hidden");
}

function zatvoriPopup() {
  getById("popupKlijent")?.classList.add("hidden");
}

function updateInvoiceSummary() {
  const base = Math.max(0, parseNumber(getById("iznos")?.value));
  const rabatPercent = Math.min(100, Math.max(0, parseNumber(getById("rabat")?.value)));
  const discount = (base * rabatPercent) / 100;
  const afterDiscount = Math.max(0, base - discount);
  const vatRate = getById("pdv")?.checked ? 0.17 : 0;
  const vatValue = afterDiscount * vatRate;
  const total = afterDiscount + vatValue;

  if (getById("summaryBase")) getById("summaryBase").textContent = formatMoney(base);
  if (getById("summaryDiscount")) getById("summaryDiscount").textContent = formatMoney(discount);
  if (getById("summaryVat")) getById("summaryVat").textContent = formatMoney(vatValue);
  if (getById("summaryTotal")) getById("summaryTotal").textContent = formatMoney(total);
}

function populateClientsDatalist(clients) {
  const datalist = getById("klijentiDatalist");
  if (!datalist) return;
  datalist.innerHTML = "";

  clients.forEach((k) => {
    const naziv = (k.naziv_firme || "").trim();
    if (!naziv) return;
    const option = document.createElement("option");
    option.value = naziv;
    datalist.appendChild(option);
  });
}

function fillClientList(clients) {
  const lista = getById("listaKlijenata");
  if (!lista) return;
  lista.innerHTML = "";

  if (!clients.length) {
    const li = document.createElement("li");
    li.textContent = "Nema dostupnih klijenata.";
    lista.appendChild(li);
    return;
  }

  clients.forEach((k) => {
    const li = document.createElement("li");
    const brojFakture = k.broj_fakture || k.brojFakture || k.faktura_broj || "-";
    li.textContent = `${k.naziv_firme || "Nepoznat klijent"} - ${k.grad}`;
    lista.appendChild(li);
  });
}

function fillToursList(tours) {
  const lista = getById("listaTura");
  if (!lista) return;
  lista.innerHTML = "";

  if (!tours.length) {
    const li = document.createElement("li");
    li.textContent = "Nema dostupnih tura.";
    lista.appendChild(li);
    return;
  }

  tours.forEach((t) => {
  const li = document.createElement("li");

  const br_fakture = t.id_fakture || "-";
  const naziv_firme = t.naziv_firme || "-";
  const datum = t.datum || "-";
  const cijena = t.cijena || "-";
  const relacija = t.relacija || "-";

  // Ako iz baze već dobijaš puni Google Drive download link
  const pdf_link = t.pdf_link || "#";

  li.innerHTML = `
    Firma ${naziv_firme} | Broj fakture: ${br_fakture} | Datum: ${datum} |
    Relacija: ${relacija} | Cijena: ${cijena} KM |
    <a href="${pdf_link}" download="FAKTURA_${br_fakture}.pdf">
      Preuzmi fakturu
    </a>
  `;

  lista.appendChild(li);
});
}

function fillEmployeeList(employees) {
  const lista = getById("listaZaposlenih");
  if (!lista) return;
  lista.innerHTML = "";

  if (!employees.length) {
    const li = document.createElement("li");
    li.textContent = "Nema dostupnih vozača.";
    lista.appendChild(li);
    return;
  }

  employees.forEach((z) => {
    const li = document.createElement("li");
    const ime = z.ime || z.naziv || "Nepoznat vozač";
    const telefon = z.broj_telefona || z.telefon || "-";
    li.textContent = `${ime} | Telefon: ${telefon}`;
    lista.appendChild(li);
  });
}

function getPageSlice(items, page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return items.slice(start, end);
}

function updatePageInfo(type, totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  currentPage[type] = Math.min(Math.max(1, currentPage[type]), totalPages);
  const infoMap = {
    clients: "clientsPageInfo",
    tours: "toursPageInfo",
    employees: "employeesPageInfo"
  };
  const info = getById(infoMap[type]);
  if (info) info.textContent = `Stranica ${currentPage[type]} / ${totalPages}`;
}

function renderClientsPage() {
  updatePageInfo("clients", filteredClients.length);
  fillClientList(getPageSlice(filteredClients, currentPage.clients));
}

function renderToursPage() {
  updatePageInfo("tours", cachedTours.length);
  fillToursList(getPageSlice(cachedTours, currentPage.tours));
}

function renderEmployeesPage() {
  updatePageInfo("employees", cachedEmployees.length);
  fillEmployeeList(getPageSlice(cachedEmployees, currentPage.employees));
}

function promijeniStranicu(type, direction) {
  const collections = {
    clients: filteredClients,
    tours: cachedTours,
    employees: cachedEmployees
  };
  const list = collections[type] || [];
  const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
  const next = currentPage[type] + direction;
  if (next < 1 || next > totalPages) return;
  currentPage[type] = next;

  if (type === "clients") renderClientsPage();
  if (type === "tours") renderToursPage();
  if (type === "employees") renderEmployeesPage();
}

function primijeniKlijentPretragu() {
  const query = (getById("klijentSearch")?.value || "").trim().toLowerCase();
  if (!query) {
    filteredClients = [...cachedClients];
  } else {
    filteredClients = cachedClients.filter((k) => {
      const naziv = (k.naziv_firme || "").toLowerCase();
      const broj = String(k.broj_fakture || k.brojFakture || k.faktura_broj || "").toLowerCase();
      return naziv.includes(query) || broj.includes(query);
    });
  }
  currentPage.clients = 1;
  renderClientsPage();
}

function ocistiKlijentPretragu() {
  const input = getById("klijentSearch");
  if (input) input.value = "";
  filteredClients = [...cachedClients];
  currentPage.clients = 1;
  renderClientsPage();
}

function buildInvoicePayload() {
  const ime_klijenta = getById("ime_klijenta")?.value.trim() || "";
  const relacija = getById("relacija")?.value.trim() || "";
  const datum = getById("datum")?.value || "";
  const mjesto_isporuke = getById("mjesto_isporuke")?.value.trim() || "";
  const rok_placanja = getById("rok_placanja")?.value.trim() || "";
  const iznos = Math.max(0, parseNumber(getById("iznos")?.value));
  const rabat = Math.min(100, Math.max(0, parseNumber(getById("rabat")?.value)));
  const pdv = getById("pdv")?.checked ? 17 : 0;

  if (!ime_klijenta || !relacija || !datum || !mjesto_isporuke || !rok_placanja || iznos <= 0) {
    return { error: "Popuni sva obavezna polja i unesi ispravan iznos." };
  }

  const discountValue = (iznos * rabat) / 100;
  const subtotal = Math.max(0, iznos - discountValue);
  const vatValue = pdv ? subtotal * 0.17 : 0;
  const ukupno = subtotal + vatValue;

  return {
    payload: {
      action: "napravi_fakturu",
      ime_klijenta,
      relacija,
      iznos,
      datum,
      mjesto_isporuke,
      rok_placanja,
      rabat,
      pdv,
      ukupno
    }
  };
}

function extractFilenameFromContentDisposition(contentDisposition, fallbackName) {
  if (!contentDisposition) return fallbackName;
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match && match[1] ? match[1] : fallbackName;
}

async function submitInvoicePayload(payload) {
  const faktura = getById("faktura");
  const loading = getById("loading");
  const submitBtn = getById("submitInvoiceBtn");

  if (faktura) faktura.style.display = "none";
  if (loading) loading.classList.remove("hidden");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await apiPost(payload);
    if (!res.ok) {
      throw new Error("Greška servera prilikom izrade fakture.");
    }

    const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.missingClient === true) {
        pendingInvoicePayload = payload;
        setStatus("Klijent ne postoji. Dodaj klijenta pa nastavljamo automatski.", "error");
        otvoriPopup();
        return;
      }
      throw new Error(data?.message || "Neispravan odgovor servera za fakturu.");
    }

    if (!contentType.includes("application/pdf")) {
      throw new Error("Server nije vratio PDF dokument.");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const fallback = `faktura_${payload.ime_klijenta}_${payload.datum}.pdf`;
    const fileName = extractFilenameFromContentDisposition(
      res.headers.get("Content-Disposition"),
      fallback
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Faktura je uspješno kreirana i preuzeta.", "success");
    pendingInvoicePayload = null;
  } catch (error) {
    setStatus(error.message || "Greška prilikom izrade fakture.", "error");
  } finally {
    resetInvoiceLoadingState();
  }
}

async function napraviFakturu() {
  setStatus("");
  const result = buildInvoicePayload();
  if (result.error) {
    setStatus(result.error, "error");
    return;
  }
  pendingInvoicePayload = result.payload;
  await submitInvoicePayload(result.payload);
}

async function sacuvajKlijenta() {
  try {
    const naziv_firme = getById("nazivFirme")?.value.trim() || "";
    const grad = getById("grad")?.value.trim() || "";
    if (!naziv_firme || !grad) {
      setStatus("Naziv firme i grad su obavezni.", "error");
      return;
    }

    const payload = {
      action: "dodaj_klijenta",
      naziv_firme,
      jib: getById("jib")?.value.trim() || "",
      pib: getById("pib")?.value.trim() || "",
      adresa: getById("adresa")?.value.trim() || "",
      grad,
      mail: getById("mail")?.value.trim() || "",
      broj_telefona: getById("telefon")?.value.trim() || ""
    };

    const res = await apiPost(payload);
    if (!res.ok) {
      throw new Error("Klijent nije sačuvan. Provjeri podatke i pokušaj ponovo.");
    }

    zatvoriPopup();
    setStatus("Klijent je uspješno sačuvan.", "success");
    await ucitajKlijente();

    if (pendingInvoicePayload) {
      await submitInvoicePayload(pendingInvoicePayload);
    }
  } catch (error) {
    setStatus(error.message || "Greška prilikom snimanja klijenta.", "error");
  }
}

async function ucitajKlijente() {
  try {
    const res = await apiPost({ action: "lista_klijenata" });
    if (!res.ok) {
      throw new Error("Ne mogu učitati klijente.");
    }

    const data = await res.json();
    const clients = normalizeListPayload(data);
    cachedClients = clients;
    filteredClients = [...clients];
    currentPage.clients = 1;
    renderClientsPage();
    populateClientsDatalist(clients);
  } catch (error) {
    setStatus(error.message || "Greška pri učitavanju klijenata.", "error");
  }
}

async function ucitajTure() {
  try {
    const res = await apiPost({ action: "lista_tura" });
    if (!res.ok) {
      throw new Error("Ne mogu učitati ture.");
    }

    const data = await res.json();
    cachedTours = normalizeListPayload(data);
    currentPage.tours = 1;
    renderToursPage();
  } catch (error) {
    setStatus(error.message || "Greška pri učitavanju tura.", "error");
  }
}

async function ucitajZaposlene() {
  try {
    const ime = getById("vozacSearch")?.value.trim() || "";
    const res = await apiPost({
      action: "pretraga_zaposlenih",
      ime
    });
    if (!res.ok) {
      throw new Error("Ne mogu učitati vozače.");
    }

    const data = await res.json();
    cachedEmployees = normalizeListPayload(data);
    currentPage.employees = 1;
    renderEmployeesPage();
  } catch (error) {
    setStatus(error.message || "Greška pri učitavanju vozača.", "error");
  }
}

function turePoDatumu() {
  setStatus("Filtriranje tura po datumu nije aktivno u ovoj MVP verziji.", "error");
}

function prihodi() {
  setStatus("Pregled prihoda nije aktivan u ovoj MVP verziji.", "error");
}

document.addEventListener("DOMContentLoaded", () => {
  show("faktura");
  ucitajKlijente();
  updateInvoiceSummary();

  ["iznos", "rabat", "pdv"].forEach((id) => {
    const el = getById(id);
    if (!el) return;
    el.addEventListener("input", updateInvoiceSummary);
    el.addEventListener("change", updateInvoiceSummary);
  });

  getById("klijentSearch")?.addEventListener("input", primijeniKlijentPretragu);
});