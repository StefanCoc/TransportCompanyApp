const N8N_WEBHOOK = "http://localhost:5678/webhook/api";
const ITEMS_PER_PAGE = 10;
const ACTIVE_PAGE_DISPLAYS = { faktura: "grid", klijenti: "block", ture: "block", zaposleni: "block" };
let cachedClients = [];
let filteredClients = [];
let cachedTours = [];
let filteredTours = [];
let cachedEmployees = [];
let filteredEmployees = [];
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

function prettifyKey(key) {
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDisplayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function otvoriDetalje(title, data) {
  const popup = getById("popupDetalji");
  const naslov = getById("detaljiNaslov");
  const sadrzaj = getById("detaljiSadrzaj");
  if (!popup || !naslov || !sadrzaj) return;

  naslov.textContent = title;
  sadrzaj.innerHTML = "";

  Object.entries(data || {}).forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "details-item";
    row.innerHTML = `<strong>${prettifyKey(key)}:</strong> ${toDisplayValue(value)}`;
    sadrzaj.appendChild(row);
  });

  popup.classList.remove("hidden");
}

function zatvoriDetalje() {
  getById("popupDetalji")?.classList.add("hidden");
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
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = "Nema dostupnih klijenata.";
    tr.appendChild(td);
    lista.appendChild(tr);
    return;
  }

  clients.forEach((k) => {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    const tdFirma = document.createElement("td");
    tdFirma.textContent = k.naziv_firme || "Nepoznat klijent";
    const tdGrad = document.createElement("td");
    tdGrad.textContent = k.grad || "-";
    tr.appendChild(tdFirma);
    tr.appendChild(tdGrad);
    tr.addEventListener("click", () => {
      otvoriDetalje(`Klijent: ${k.naziv_firme || "-"}`, k);
    });
    lista.appendChild(tr);
  });
}

function formatDateToDdMmYy(value) {
  if (!value) return "-";
  const isoDate = String(value).split("T")[0];
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year.slice(-2)}`;
  }
  return String(value);
}

function fillToursList(tours) {
  const lista = getById("listaTura");
  if (!lista) return;
  lista.innerHTML = "";

  if (!tours.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Nema dostupnih tura.";
    tr.appendChild(td);
    lista.appendChild(tr);
    return;
  }

  tours.forEach((t) => {
    const tr = document.createElement("tr");
    const br_fakture = t.id_fakture || t.broj_fakture || t.brojFakture || t.faktura_broj || "-";
    const naziv_firme = t.naziv_firme || "-";
    const datum = formatDateToDdMmYy(t.datum);
    const cijena = t.cijena || "-";
    const relacija = t.relacija || "-";
    const pdf_link = t.pdf_link || "#";

    const tdBroj = document.createElement("td");
    tdBroj.textContent = String(br_fakture);
    const tdFirma = document.createElement("td");
    tdFirma.textContent = naziv_firme;
    const tdDatum = document.createElement("td");
    tdDatum.textContent = datum;
    const tdRelacija = document.createElement("td");
    tdRelacija.textContent = relacija;
    const tdCijena = document.createElement("td");
    tdCijena.textContent = `${cijena} KM`;
    const tdPdf = document.createElement("td");
    const link = document.createElement("a");
    link.href = pdf_link;
    link.textContent = "Preuzmi";
    link.setAttribute("download", `FAKTURA_${br_fakture}.pdf`);
    tdPdf.appendChild(link);

    tr.appendChild(tdBroj);
    tr.appendChild(tdFirma);
    tr.appendChild(tdDatum);
    tr.appendChild(tdRelacija);
    tr.appendChild(tdCijena);
    tr.appendChild(tdPdf);
    lista.appendChild(tr);
  });
}

function fillEmployeeList(employees) {
  const lista = getById("listaZaposlenih");
  if (!lista) return;
  lista.innerHTML = "";

  if (!employees.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Nema dostupnih zaposlenih.";
    tr.appendChild(td);
    lista.appendChild(tr);
    return;
  }

  employees.forEach((z) => {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    const ime = z.ime || "Nepoznat vozač";
    const prezime = z.prezime || "-";
    const pozicija = z.pozicija || "-";
    const plata = z.plata || "-";
    const tdIme = document.createElement("td");
    tdIme.textContent = ime;
    const tdPrezime = document.createElement("td");
    tdPrezime.textContent = prezime;
    const tdPozicija = document.createElement("td");
    tdPozicija.textContent = pozicija;
    const tdPlata = document.createElement("td");
    tdPlata.textContent = `${plata} KM`;
    tr.appendChild(tdIme);
    tr.appendChild(tdPrezime);
    tr.appendChild(tdPozicija);
    tr.appendChild(tdPlata);
    tr.addEventListener("click", () => {
      otvoriDetalje(`Zaposleni: ${ime} ${prezime}`, z);
    });
    lista.appendChild(tr);
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
  updatePageInfo("tours", filteredTours.length);
  fillToursList(getPageSlice(filteredTours, currentPage.tours));
}

function renderEmployeesPage() {
  updatePageInfo("employees", filteredEmployees.length);
  fillEmployeeList(getPageSlice(filteredEmployees, currentPage.employees));
}

function promijeniStranicu(type, direction) {
  const collections = {
    clients: filteredClients,
    tours: filteredTours,
    employees: filteredEmployees
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

function primijeniTuraPretragu() {
  const query = (getById("turaSearch")?.value || "").trim().toLowerCase();
  if (!query) {
    filteredTours = [...cachedTours];
  } else {
    filteredTours = cachedTours.filter((t) => {
      const brojFakture = String(
        t.id_fakture ?? t.broj_fakture ?? t.brojFakture ?? t.faktura_broj ?? ""
      ).toLowerCase();
      return brojFakture.includes(query);
    });
  }
  currentPage.tours = 1;
  renderToursPage();
}

function ocistiTuraPretragu() {
  const input = getById("turaSearch");
  if (input) input.value = "";
  filteredTours = [...cachedTours];
  currentPage.tours = 1;
  renderToursPage();
}
function prikaziFilterTura(tip) {
  const broj = getById("filterBrojFakture");
  const datum = getById("filterDatumTure");

  if (!broj || !datum) return;

  broj.classList.add("hidden");
  datum.classList.add("hidden");

  if (tip === "broj") {
    broj.classList.remove("hidden");
  }

  if (tip === "datum") {
    datum.classList.remove("hidden");
  }
}

function resetTourFilters() {
  const brojInput = getById("turaSearch");
  const datumOd = getById("datumOd");
  const datumDo = getById("datumDo");

  if (brojInput) brojInput.value = "";
  if (datumOd) datumOd.value = "";
  if (datumDo) datumDo.value = "";

  filteredTours = [...cachedTours];
  currentPage.tours = 1;
  renderToursPage();

  getById("filterBrojFakture")?.classList.add("hidden");
  getById("filterDatumTure")?.classList.add("hidden");

  setStatus("Filteri su očišćeni.", "success");
}

function primijeniZaposleniPretragu() {
  const query = (getById("vozacSearch")?.value || "").trim().toLowerCase();
  if (!query) {
    filteredEmployees = [...cachedEmployees];
  } else {
    filteredEmployees = cachedEmployees.filter((z) => {
      const ime = String(z.ime || "").toLowerCase();
      const prezime = String(z.prezime || "").toLowerCase();
      const punoIme = `${ime} ${prezime}`.trim();
      return ime.includes(query) || prezime.includes(query) || punoIme.includes(query);
    });
  }
  currentPage.employees = 1;
  renderEmployeesPage();
}

function ocistiZaposleniPretragu() {
  const input = getById("vozacSearch");
  if (input) input.value = "";
  filteredEmployees = [...cachedEmployees];
  currentPage.employees = 1;
  renderEmployeesPage();
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
    filteredTours = [...cachedTours];
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
    filteredEmployees = [...cachedEmployees];
    currentPage.employees = 1;
    renderEmployeesPage();
  } catch (error) {
    setStatus(error.message || "Greška pri učitavanju vozača.", "error");
  }
}

function turePoDatumu() {
  try {
    const datumOd = getById("datumOd")?.value || "";
    const datumDo = getById("datumDo")?.value || "";

    // Ako ništa nije uneseno -> vrati sve ture
    if (!datumOd && !datumDo) {
      filteredTours = [...cachedTours];
      currentPage.tours = 1;
      renderToursPage();
      setStatus("Prikazane su sve ture.", "success");
      return;
    }

    const od = datumOd ? new Date(datumOd) : null;
    const doDate = datumDo ? new Date(datumDo) : null;

    // Da datumDo obuhvati cijeli dan
    if (doDate) {
      doDate.setHours(23, 59, 59, 999);
    }

    filteredTours = cachedTours.filter((t) => {
      if (!t.datum) return false;

      const datumTure = new Date(t.datum);

      if (od && datumTure < od) return false;
      if (doDate && datumTure > doDate) return false;

      return true;
    });

    currentPage.tours = 1;
    renderToursPage();

    if (filteredTours.length) {
      setStatus(`Pronađeno ${filteredTours.length} tura u odabranom periodu.`, "success");
    } else {
      setStatus("Nema tura za odabrani period.", "error");
    }

  } catch (error) {
    setStatus("Greška pri filtriranju tura po datumu.", "error");
  }
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
  getById("turaSearch")?.addEventListener("input", primijeniTuraPretragu);
  getById("vozacSearch")?.addEventListener("input", primijeniZaposleniPretragu);
});