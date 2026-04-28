// 🔗 n8n webhook
const N8N_WEBHOOK =
                "http://localhost:5678/webhook-test/api"
// =========================
// 🧭 NAVIGACIJA (menu switch)
// =========================
function show(page) {
  document.querySelectorAll(".page").forEach(p => (p.style.display = "none"));
  const el = document.getElementById(page);

  if (page === "listaKlijenata") {
    el.style.display = "grid";
  } else {
    el.style.display = "block";
  }
}


function otvoriPopup() {
  document.getElementById("popupKlijent").classList.remove("hidden");
}

function zatvoriPopup() {
  document.getElementById("popupKlijent").classList.add("hidden");
}

async function sacuvajKlijenta() {
  const payload = {
    action: "dodaj_klijenta",
    naziv_firme: document.getElementById("nazivFirme").value,
    jib: document.getElementById("jib").value,
    pib: document.getElementById("pib").value,
    adresa: document.getElementById("adresa").value,
    grad: document.getElementById("grad").value,
    mail: document.getElementById("mail").value,
    broj_telefona: document.getElementById("telefon").value
  };

  await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  zatvoriPopup();
  ucitajKlijente();
}

async function napraviFakturu() {
    // Sakrij formu
    document.getElementById("faktura").style.display = "none";

    // Prikaži loading
    document.getElementById("loading").style.display = "block";
    document.getElementById("loading").innerHTML = `
      <h2>Izrada fakture je u toku...</h2>
      <p>Molimo sačekajte.</p>
    `;

    const ime_klijenta = document.getElementById("ime_klijenta").value;
    const relacija = document.getElementById("relacija").value;
    const iznos = document.getElementById("iznos").value;
    const datum = document.getElementById("datum").value;
    const mjesto_isporuke = document.getElementById("mjesto_isporuke").value;
    const rok_placanja = document.getElementById("rok_placanja").value;
    const rabat = document.getElementById("rabat").value;
    const pdv = document.getElementById("pdv").checked ? 17 : 0;

    const res = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "napravi_fakturu",
        ime_klijenta,
        relacija,
        iznos,
        datum,
        mjesto_isporuke,
        rok_placanja,
        rabat,
        pdv
      })
    });

    if (!res.ok) {
      document.getElementById("loading").style.display = "none";
      document.getElementById("faktura").style.display = "grid";
      throw new Error("Greška servera");
    }

    const resClone = res.clone();

    let data = null;
    try {
      data = await resClone.json();
    } catch (e) {
      data = null;
    }

    // 👉 Novi klijent
    if (data && data.missingClient === true) {
      document.getElementById("loading").style.display = "none";
      document.getElementById("faktura").style.display = "grid";
      otvoriPopup();
      return;
    }

    // 👉 PDF
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Faktura_${ime_klijenta}_${datum}.pdf`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // ✅ Nakon završetka:
    document.getElementById("loading").style.display = "none";
    document.getElementById("faktura").style.display = "grid";
}

// async function napraviFakturu() {
//     // Sakrij formu
//     document.getElementById("faktura").style.display = "none";

//     // Prikaži loading
//     document.getElementById("loading").style.display = "block";

//     // Sakrij loading kada završi
//     document.getElementById("loading").style.display = "none";

//     const ime_klijenta = document.getElementById("ime_klijenta").value;
//     const relacija = document.getElementById("relacija").value;
//     const iznos = document.getElementById("iznos").value;
//     const datum = document.getElementById("datum").value;
//     const mjesto_isporuke = document.getElementById("mjesto_isporuke").value;
//     const rok_placanja = document.getElementById("rok_placanja").value;
//     const rabat = document.getElementById("rabat").value;
//     const pdv = document.getElementById("pdv").checked ? 17 : 0;


//     const res = await fetch(N8N_WEBHOOK, {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify({
//     action: "napravi_fakturu",
//     ime_klijenta,
//     relacija,
//     iznos,
//     datum,
//     mjesto_isporuke,
//     rok_placanja,
//     rabat,
//     pdv
//   })
// });

// if (!res.ok) {
//   throw new Error("Greška servera");
// }

// // 🔥 KLONIRAMO response (ključ fix-a)
// const resClone = res.clone();

// // pokušaj JSON
// let data = null;
// try {
//   data = await resClone.json();
// } catch (e) {
//   data = null;
// }

// // 👉 NOVI KLIJENT
// if (data && data.missingClient === true) {
//   otvoriPopup();
//   return;
// }

// // 👉 AKO NIJE JSON => PDF
// const blob = await res.blob();
// const url = URL.createObjectURL(blob);

// const link = document.createElement("a");
// link.href = url;
// link.download = `Faktura_${ime_klijenta}_${datum}.pdf`;
// link.click();

// setTimeout(() => URL.revokeObjectURL(url), 1000);
// }

// =========================
// 📄 2. LISTA KLIJENATA
// =========================
async function ucitajKlijente() {
  const res = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "lista_klijenata"
    })
  });

  const data = await res.json();

  console.log("DATA:", data);
  console.log("TYPE:", typeof data);
  console.log("IS ARRAY:", Array.isArray(data));

  const lista = document.getElementById("listaKlijenata");
  lista.innerHTML = "";

  // 🔥 fallback da pokrijemo sve slučajeve
  const listaPodataka =
    Array.isArray(data) ? data :
    Array.isArray(data.data) ? data.data :
    Array.isArray(data.body) ? data.body :
    [];

  console.log("KORISTIM:", listaPodataka);

  listaPodataka.forEach(k => {
    const li = document.createElement("li");
    li.textContent = `${k.naziv_firme} - ${k.grad}`;
    lista.appendChild(li);
  });
}


// =========================
// 📦 3. LISTA TURA
// =========================
async function ucitajTure() {
  const res = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "lista_tura"
    })
  });

  const data = await res.json();

  const lista = document.getElementById("listaTura");
  lista.innerHTML = "";

  data.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `Tura ${t.id} | ${t.polaziste} → ${t.odrediste}`;
    lista.appendChild(li);
  });
}


// =========================
// 🚗 4. PRETRAGA VOZILA
// =========================
async function pretragaVozila() {
  const reg = document.getElementById("reg").value;

  const res = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "pretraga_vozila",
      registracija: reg
    })
  });

  const data = await res.json();

  const lista = document.getElementById("rezultatVozila");
  lista.innerHTML = "";

  data.forEach(v => {
    const li = document.createElement("li");
    li.textContent = v.registracija;
    lista.appendChild(li);
  });
}


// =========================
// 👷 5. PRETRAGA ZAPOSLENIH
// =========================
async function pretragaZaposlenih() {
  const ime = document.getElementById("ime").value;

  const res = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "pretraga_zaposlenih",
      ime
    })
  });

  const data = await res.json();

  const lista = document.getElementById("rezultatZaposlenih");
  lista.innerHTML = "";

  data.forEach(z => {
    const li = document.createElement("li");
    li.textContent = z.ime;
    lista.appendChild(li);
  });
}


// =========================
// 📅 6. TURE PO DATUMU
// =========================
async function turePoDatumu() {
  const datum = document.getElementById("datum").value;

  const res = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ture_po_datumu",
      datum
    })
  });

  const data = await res.json();

  const lista = document.getElementById("listaTuraDatum");
  lista.innerHTML = "";

  data.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `${t.polaziste} → ${t.odrediste} (${t.datum})`;
    lista.appendChild(li);
  });
}


// =========================
// 📊 7. PRIHODI PO MJESECIMA
// =========================
async function prihodi() {
  const res = await fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "prihodi_mjeseci"
    })
  });

  const data = await res.json();

  const lista = document.getElementById("prihodiList");
  lista.innerHTML = "";

  data.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `Mjesec ${p.mjesec}: ${p.ukupno} KM`;
    lista.appendChild(li);
  });
}