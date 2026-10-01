// Demo documents for the España 2026 extension (Granada, Valencia, San
// Sebastián): boarding passes, bus tickets, hotel confirmations and entry
// tickets. Same builder and flow as espana-2026-documents.js.
//
// Run espana-2026-extension.sql first. Then paste into the browser console on
// the trip's Documentos page while signed in as an owner or editor.

(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- Minimal PDF builder: A5, Helvetica, WinAnsi (Spanish accents OK) ----
  const latin = (s) =>
    s.replace(/→/g, "->").replace(/[–—]/g, "-").replace(/€/g, "\x80").replace(/[^\x00-\xff]/g, "?");
  const esc = (s) => latin(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const text = (color, font, size, x, y, s) => `BT ${color} rg /${font} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET\n`;

  function pdf({ brand, title, subtitle, rows, code, footer }) {
    const W = 420, H = 595;
    let c = `0.122 0.369 0.859 rg 0 ${H - 90} ${W} 90 re f\n`;
    c += text("1 1 1", "F2", 11, 28, H - 32, brand);
    c += text("1 1 1", "F2", 18, 28, H - 58, title);
    if (subtitle) c += text("0.9 0.94 1", "F1", 10, 28, H - 76, subtitle);
    let y = H - 125;
    for (const [k, v] of rows) {
      c += text("0.35 0.42 0.51", "F1", 8, 28, y, k.toUpperCase());
      c += text("0.04 0.11 0.2", "F2", 12, 28, y - 15, v);
      c += `0.89 0.91 0.94 RG 0.5 w 28 ${y - 24} m ${W - 28} ${y - 24} l S\n`;
      y -= 40;
    }
    if (code) {
      // A barcode-looking pattern derived from the code (not a real symbology).
      let seed = 0;
      for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
      c += "0 0 0 rg\n";
      for (let x = 28; x < W - 28; ) {
        seed = (seed * 97 + 13) % 9973;
        const w = 1 + (seed % 3);
        c += `${x} 70 ${w} 55 re f\n`;
        x += w + 1 + (seed % 2);
      }
      c += text("0.04 0.11 0.2", "F1", 9, 28, 55, code);
    }
    if (footer) c += text("0.35 0.42 0.51", "F1", 7, 28, 30, footer);

    const objs = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      `<< /Length ${c.length} >>\nstream\n${c}endstream`,
    ];
    let out = "%PDF-1.4\n";
    const offsets = objs.map((o, i) => {
      const at = out.length;
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
      return at;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    // Every character is one byte (latin1), so string offsets are byte offsets.
    return new Blob([Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff)], { type: "application/pdf" });
  }

  // ---- PNG ticket with a QR-looking square ----
  async function png({ title, lines, code }) {
    const cv = document.createElement("canvas");
    cv.width = 600;
    cv.height = 900;
    const g = cv.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 600, 900);
    g.fillStyle = "#1F5EDB";
    g.fillRect(0, 0, 600, 120);
    g.fillStyle = "#fff";
    g.font = "bold 34px sans-serif";
    g.fillText(title, 32, 75);
    g.fillStyle = "#0B1B33";
    g.font = "24px sans-serif";
    lines.forEach((l, i) => g.fillText(l, 32, 180 + i * 40));
    let seed = 7;
    for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
    for (let r = 0; r < 25; r++)
      for (let q = 0; q < 25; q++) {
        seed = (seed * 97 + 13) % 9973;
        const corner = (r < 7 && q < 7) || (r < 7 && q > 17) || (r > 17 && q < 7);
        const ring = r % 6 === 0 || q % 6 === 0 || r === 1 || q === 1 || r === 23 || q === 23;
        if (corner ? ring : seed % 2 === 0) g.fillRect(150 + q * 12, 420 + r * 12, 12, 12);
      }
    g.font = "20px monospace";
    g.fillText(code, 32, 840);
    return new Promise((res) => cv.toBlob(res, "image/png"));
  }

  // ---- Drive the real upload form ----
  const form = [...document.querySelectorAll("form")].find((f) => f.querySelector("input[type=file]"));
  if (!form) throw new Error("Open the trip's Documentos page as an owner or editor first.");
  const input = form.querySelector("input[type=file]");
  const [typeSelect, targetSelect] = form.querySelectorAll("select");
  // React listens for "change" and reads the value through the native setter.
  const setSelect = (sel, v) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, v);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  };

  /** `attachTo` is the exact name after the date in the picker ("29 sep · 10:00 · <name>"); omit for a trip document. */
  async function upload({ name, blob, docType, attachTo }) {
    const option = attachTo
      ? [...targetSelect.options].find((o) => o.textContent.split(" · ").slice(2).join(" · ") === attachTo)
      : null;
    if (attachTo && !option) return `${name}: no encontré "${attachTo}"`;
    const dt = new DataTransfer();
    dt.items.add(new File([blob], name, { type: blob.type }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    setSelect(typeSelect, docType);
    setSelect(targetSelect, option ? option.value : "");
    await sleep(150);
    form.querySelector("button[type=submit]").click();
    for (let i = 0; i < 100; i++) {
      await sleep(200);
      const error = form.querySelector("[role=alert]");
      if (error) return `${name}: ERROR ${error.textContent}`;
      if (!input.files.length && form.querySelector("button[type=submit]").textContent.includes("Subir")) return `${name}: ok`;
    }
    return `${name}: sin respuesta`;
  }

  const boarding = (who, seat) =>
    pdf({
      brand: "AEROMÉXICO",
      title: "Pase de abordar · AM 23",
      subtitle: "MEX Ciudad de México  ->  BCN Barcelona",
      rows: [
        ["Pasajero", who],
        ["Fecha", "Domingo 27 septiembre 2026"],
        ["Salida", "19:40 · Terminal 2 · Puerta 72"],
        ["Abordaje", "18:50 · Grupo 4"],
        ["Asiento", `${seat} · Clase turista`],
        ["Localizador", "QXPL7M"],
      ],
      code: `M1${who.replace(/[^A-Z/]/g, "")} QXPL7M MEXBCNAM 0023 270Y0${seat}`,
      footer: "La puerta cierra 20 min antes de la salida.",
    });
  const train = (number, route, date, times, seats, fare, ref) =>
    pdf({
      brand: "RENFE · AVE",
      title: `Billete AVE ${number}`,
      subtitle: route,
      rows: [
        ["Fecha", date],
        ["Horario", times],
        ["Coche / Plazas", seats],
        ["Viajeros", "Alberto Chávez Bautista · Ximena Bautista"],
        ["Tarifa", fare],
        ["Localizador", ref],
      ],
      code: `${ref}-${number}`,
      footer: "Acceso a andén hasta 2 minutos antes de la salida.",
    });
  const hotel = (brand, name, address, dates, room, total, ref, note) =>
    pdf({
      brand,
      title: "Confirmación de reserva",
      subtitle: name,
      rows: [
        ["Dirección", address],
        ["Estancia", dates],
        ["Habitación", room],
        ["Huéspedes", "Alberto Chávez Bautista · Ximena Bautista"],
        ["Total", total],
        ["Número de confirmación", ref],
      ],
      footer: note,
    });
  const entry = (brand, title, subtitle, date, people, total, ref, note) =>
    pdf({
      brand,
      title,
      subtitle,
      rows: [
        ["Fecha y hora", date],
        ["Entradas", people],
        ["Total", total],
        ["Código de reserva", ref],
      ],
      code: ref,
      footer: note,
    });

  const docs = [
    // Transportation
    { name: "Billete ALSA Málaga-Granada.pdf", docType: "ticket", attachTo: "Autobús Málaga · Estación de autobuses → Granada · Estación de autobuses", blob: pdf({ brand: "ALSA", title: "Billete de autobús 7105", subtitle: "Málaga  ->  Granada", rows: [["Fecha", "Domingo 11 octubre 2026"], ["Horario", "Salida 10:30 · Llegada 12:15"], ["Andén", "8"], ["Asientos", "21, 22"], ["Importe", "26,40 €"], ["Localizador", "ALS-10233"]], code: "ALS10233-7105-2122" }) },
    { name: "Tarjetas de embarque VY2215.pdf", docType: "flight", attachTo: "Vuelo Granada (GRX) → Valencia (VLC)", blob: pdf({ brand: "VUELING", title: "Tarjetas de embarque · VY 2215", subtitle: "GRX Granada  ->  VLC Valencia", rows: [["Fecha", "Martes 13 octubre 2026"], ["Salida", "11:10 · Embarque 10:35"], ["Pasajeros", "Alberto Chávez Bautista · Ximena Bautista"], ["Asientos", "9C, 9D"], ["Equipaje", "1 maleta documentada de 25 kg"], ["Reserva", "VYQ8ZT"]], code: "M2CHAVEZ/BAUTISTA VYQ8ZT GRXVLCVY 2215 286Y009C", footer: "La puerta de embarque cierra 20 min antes de la salida." }) },
    { name: "Tarjetas de embarque VY1489.pdf", docType: "flight", attachTo: "Vuelo Valencia (VLC) → Bilbao (BIO)", blob: pdf({ brand: "VUELING", title: "Tarjetas de embarque · VY 1489", subtitle: "VLC Valencia  ->  BIO Bilbao", rows: [["Fecha", "Viernes 16 octubre 2026"], ["Salida", "10:15 · Embarque 09:40"], ["Pasajeros", "Alberto Chávez Bautista · Ximena Bautista"], ["Asientos", "14A, 14B"], ["Equipaje", "Solo mano"], ["Reserva", "VYM2KD"]], code: "M2CHAVEZ/BAUTISTA VYM2KD VLCBIOVY 1489 289Y014A" }) },
    // Stays
    { name: "Reserva Casa 1800 Granada.pdf", docType: "hotel", attachTo: "Hotel Casa 1800 Granada", blob: hotel("Booking.com", "Hotel Casa 1800 · Granada", "Calle Benalúa, 11", "11 - 13 oct 2026 · 2 noches", "Doble con vista a la Alhambra", "310,00 € (pagar en el hotel)", "BK-6650192", "Check-in desde 14:00.") },
    { name: "Reserva Caro Hotel.pdf", docType: "hotel", attachTo: "Caro Hotel", blob: hotel("Booking.com", "Caro Hotel · Valencia", "Carrer de l'Almirall, 14", "13 - 16 oct 2026 · 3 noches", "Doble deluxe", "585,00 € (pagado)", "BK-7012384", "Desayuno no incluido (22 € por persona).") },
    { name: "Reserva Londres y de Inglaterra.pdf", docType: "hotel", attachTo: "Hotel de Londres y de Inglaterra", blob: hotel("Expedia", "Hotel de Londres y de Inglaterra · San Sebastián", "Zubieta Kalea, 2", "16 - 19 oct 2026 · 3 noches", "Doble con vista a La Concha", "720,00 € (pagar en el hotel)", "EXP-81200457", "Salida de madrugada: avisar en recepción.") },
    // Activities
    { name: "Entradas Alhambra.pdf", docType: "ticket", attachTo: "Alhambra y Palacios Nazaríes", blob: entry("PATRONATO DE LA ALHAMBRA Y GENERALIFE", "Alhambra General", "Palacios Nazaríes 09:30", "Lunes 12 oct 2026 · 08:45", "2 adultos (nominativas)", "39,40 €", "ALH-55120931", "Presentar pasaporte. Acceso a Nazaríes solo en el horario indicado.") },
    { name: "Entradas Zambra Cueva de la Rocío.pdf", docType: "ticket", attachTo: "Zambra flamenca en Cueva de la Rocío", blob: entry("CUEVA DE LA ROCÍO", "Zambra flamenca", "Pase de las 20:30 · bebida incluida", "Domingo 11 oct 2026 · 20:30", "2 adultos", "60,00 €", "CR-1120") },
    { name: "Entradas Oceanogràfic.pdf", docType: "ticket", attachTo: "Oceanogràfic", blob: entry("L'OCEANOGRÀFIC", "Entrada general", "Ciudad de las Artes y las Ciencias", "Miércoles 14 oct 2026 · 10:15", "2 adultos", "75,40 €", "OCE-771203") },
    { name: "Voucher Albufera.pdf", docType: "tour", attachTo: "Albufera: paseo en barca y El Palmar", blob: entry("Civitatis", "Albufera: paseo en barca", "Bus + barca + visita a El Palmar", "Jueves 15 oct 2026 · 09:30", "2 adultos", "64,00 €", "CVT-AL-4410", "Salida desde la Plaza de la Reina.") },
    { name: "Reserva Elkano.png", docType: "ticket", attachTo: "Rodaballo a la parrilla en Elkano", blob: await png({ title: "Restaurante Elkano", lines: ["Domingo 18 oct 2026 · 13:30", "Mesa para 2 · Getaria", "Rodaballo a la parrilla", "Confirmación: ELK-1810"], code: "ELK-1810" }) },
  ];

  const results = [];
  for (const doc of docs) results.push(await upload(doc));
  console.table(results);
  return results;
})();
