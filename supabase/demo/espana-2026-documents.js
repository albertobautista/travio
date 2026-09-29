// Demo documents for "España 2026": 25 PDFs (boarding passes, train and bus
// tickets, hotel confirmations, entry tickets, insurance) and 2 PNG tickets.
//
// Paste into the browser console on the trip's Documentos page while signed in
// as an owner or editor (see README.md). It builds each file in the browser and
// submits it through the real upload form, so every file goes through Storage,
// registerFile and RLS exactly like a manual upload. Takes about a minute.

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
    { name: "Pase de abordar AM23 - Alberto.pdf", docType: "flight", attachTo: "Vuelo Ciudad de México (MEX) → Barcelona (BCN)", blob: boarding("CHAVEZ BAUTISTA / ALBERTO MR", "24A") },
    { name: "Pase de abordar AM23 - Ximena.pdf", docType: "flight", attachTo: "Vuelo Ciudad de México (MEX) → Barcelona (BCN)", blob: boarding("BAUTISTA / XIMENA MS", "24B") },
    { name: "Billete Renfe Barcelona-Madrid.pdf", docType: "train", attachTo: "Tren Barcelona Sants → Madrid Puerta de Atocha", blob: train("03101", "Barcelona Sants  ->  Madrid Puerta de Atocha", "Viernes 2 octubre 2026", "Salida 10:00 · Llegada 12:30", "Coche 5 · 7A, 7B", "Básico · 142,60 €", "RNF8K2Q4") },
    { name: "Billete Renfe Madrid-Sevilla.pdf", docType: "train", attachTo: "Tren Madrid Puerta de Atocha → Sevilla Santa Justa", blob: train("02111", "Madrid Puerta de Atocha  ->  Sevilla Santa Justa", "Lunes 5 octubre 2026", "Salida 09:00 · Llegada 11:38", "Coche 3 · 11C, 11D", "Básico · 118,40 €", "RNF3T9W1") },
    { name: "Billete ALSA Sevilla-Málaga.pdf", docType: "ticket", attachTo: "Autobús Sevilla · Estación Plaza de Armas → Málaga · Estación de autobuses", blob: pdf({ brand: "ALSA", title: "Billete de autobús 4012", subtitle: "Sevilla Plaza de Armas  ->  Málaga", rows: [["Fecha", "Jueves 8 octubre 2026"], ["Horario", "Salida 10:30 · Llegada 13:15"], ["Andén", "12"], ["Asientos", "15, 16"], ["Importe", "49,80 €"], ["Localizador", "ALS-99120"]], code: "ALS99120-4012-1516" }) },
    { name: "Voucher Europcar EC-5518302.pdf", docType: "other", attachTo: "Renta de auto Málaga · Estación María Zambrano", blob: pdf({ brand: "EUROPCAR", title: "Confirmación de reserva", subtitle: "Málaga · Estación María Zambrano", rows: [["Recogida", "Viernes 9 octubre 2026 · 09:00"], ["Devolución", "Sábado 10 octubre 2026 · 19:30"], ["Vehículo", "Seat Ibiza o similar · Manual"], ["Protección", "Seguro a todo riesgo · Franquicia 0 €"], ["Total", "96,00 € (pagado)"], ["Reserva", "EC-5518302"]], footer: "Presentar licencia de conducir, pasaporte y tarjeta de crédito del titular." }) },
    { name: "Iberia e-ticket IBR4QZ.pdf", docType: "flight", attachTo: "Vuelo Madrid (MAD) → Ciudad de México (MEX)", blob: pdf({ brand: "IBERIA", title: "Billete electrónico", subtitle: "AGP -> MAD -> MEX · Domingo 11 octubre 2026", rows: [["IB 3999", "Málaga 07:05  ->  Madrid 08:20 · Asientos 12A 12B"], ["IB 6403", "Madrid 12:05  ->  Ciudad de México 16:10 · 31H 31K"], ["Pasajeros", "Alberto Chávez Bautista · Ximena Bautista"], ["Equipaje", "1 maleta de 23 kg por pasajero"], ["Localizador", "IBR4QZ"]], code: "075-2419934771 / 075-2419934772" }) },
    // Stays
    { name: "Reserva Casa Bonay.pdf", docType: "hotel", attachTo: "Casa Bonay", blob: hotel("Booking.com", "Casa Bonay · Barcelona", "Gran Via de les Corts Catalanes, 700", "28 sep - 2 oct 2026 · 4 noches", "Doble con terraza · Desayuno incluido", "612,00 € (pagado)", "BK-4821937", "Check-in desde 15:00 · Check-out hasta 11:00.") },
    { name: "Reserva Only YOU Madrid.pdf", docType: "hotel", attachTo: "Only YOU Boutique Hotel Madrid", blob: hotel("Booking.com", "Only YOU Boutique Hotel · Madrid", "Calle del Barquillo, 21", "2 - 5 oct 2026 · 3 noches", "Doble superior", "489,00 € (pagado)", "BK-5530218", "Pagar tasa turística en el hotel.") },
    { name: "Reserva Casa 1800 Sevilla.pdf", docType: "hotel", attachTo: "Hotel Casa 1800 Sevilla", blob: hotel("Expedia", "Hotel Casa 1800 · Sevilla", "Calle Rodrigo Caro, 6", "5 - 8 oct 2026 · 3 noches", "Doble clásica", "540,00 € (pagado)", "EXP-77310452", "Merienda de cortesía de 17:00 a 20:00.") },
    { name: "Reserva Molina Lario.pdf", docType: "hotel", attachTo: "Molina Lario Hotel", blob: hotel("Booking.com", "Molina Lario Hotel · Málaga", "Calle Molina Lario, 20", "8 - 11 oct 2026 · 3 noches", "Doble con vista a la catedral", "438,00 € (pagar en el hotel)", "BK-6104775", "Salida de madrugada: avisar en recepción.") },
    // Activities
    { name: "Entradas Sagrada Família.pdf", docType: "ticket", attachTo: "Sagrada Família con torres", blob: entry("BASÍLICA DE LA SAGRADA FAMÍLIA", "Entrada con torres", "Torre de la Pasión · Audioguía", "Martes 29 sep 2026 · 10:00", "2 adultos", "72,00 €", "SF-2931-88", "Acceso 15 min antes.") },
    { name: "Entradas Casa Batlló.pdf", docType: "ticket", attachTo: "Casa Batlló", blob: entry("CASA BATLLÓ", "Entrada Blue", "Visita con videoguía", "Miércoles 30 sep 2026 · 10:00", "2 adultos", "70,00 €", "CB-40921") },
    { name: "Voucher Montserrat.pdf", docType: "tour", attachTo: "Excursión a Montserrat", blob: entry("GetYourGuide", "Montserrat: excursión de medio día", "Cremallera + visita guiada + cata", "Jueves 1 oct 2026 · 08:30", "2 adultos", "130,00 €", "GYG-5521904", "Punto de encuentro: Plaça de Catalunya.") },
    { name: "Entradas Museo del Prado.pdf", docType: "ticket", attachTo: "Museo del Prado", blob: entry("MUSEO NACIONAL DEL PRADO", "Entrada general", "Colección permanente", "Viernes 2 oct 2026 · 15:30", "2 adultos", "30,00 €", "MP-883120") },
    { name: "Entradas Palacio Real.pdf", docType: "ticket", attachTo: "Palacio Real", blob: entry("PATRIMONIO NACIONAL", "Palacio Real de Madrid", "Entrada general", "Sábado 3 oct 2026 · 10:00", "2 adultos", "28,00 €", "PN-120993") },
    { name: "Voucher Toledo.pdf", docType: "tour", attachTo: "Excursión a Toledo", blob: entry("Civitatis", "Excursión a Toledo", "Día completo con guía en español", "Domingo 4 oct 2026 · 09:00", "2 adultos", "110,00 €", "CVT-338120", "Salida desde Plaza de Oriente. Regreso aprox. 17:00.") },
    { name: "Entradas Real Alcázar.pdf", docType: "ticket", attachTo: "Real Alcázar", blob: entry("REAL ALCÁZAR DE SEVILLA", "Visita general", "Palacio y jardines", "Lunes 5 oct 2026 · 16:00", "2 adultos", "31,00 €", "RAS-701224", "El acceso cierra 15 min después de la hora.") },
    { name: "Entradas Catedral de Sevilla.pdf", docType: "ticket", attachTo: "Catedral y La Giralda", blob: entry("CATEDRAL DE SEVILLA", "Catedral + Giralda", "Visita general", "Martes 6 oct 2026 · 10:00", "2 adultos", "26,00 €", "CS-44102") },
    { name: "Entradas flamenco Casa de la Memoria.pdf", docType: "ticket", attachTo: "Flamenco en Casa de la Memoria", blob: entry("CASA DE LA MEMORIA", "Espectáculo de flamenco", "Pase de las 21:00", "Martes 6 oct 2026 · 21:00", "2 adultos", "50,00 €", "CM-2110", "Llegar 20 minutos antes. Asientos no numerados.") },
    { name: "Reserva Aire Baños Árabes.pdf", docType: "ticket", attachTo: "Baños árabes Aire de Sevilla", blob: entry("AIRE ANCIENT BATHS", "Baño termal 90 min", "Circuito de aguas", "Miércoles 7 oct 2026 · 16:30", "1 adulto (Ximena)", "62,00 €", "AIRE-3304", "Llevar traje de baño.") },
    { name: "Entradas Alcazaba.pdf", docType: "ticket", attachTo: "Alcazaba y Teatro Romano", blob: entry("ALCAZABA DE MÁLAGA", "Alcazaba + Gibralfaro", "Entrada combinada", "Jueves 8 oct 2026 · 16:00", "2 adultos", "20,00 €", "ALC-8812") },
    { name: "Entradas Museo Picasso Málaga.pdf", docType: "ticket", attachTo: "Museo Picasso Málaga", blob: entry("MUSEO PICASSO MÁLAGA", "Colección + exposición temporal", "Entrada general", "Sábado 10 oct 2026 · 17:00", "2 adultos", "24,00 €", "MPM-7812") },
    { name: "Entradas Park Güell.png", docType: "ticket", attachTo: "Park Güell", blob: await png({ title: "Park Güell", lines: ["Martes 29 sep 2026 · 16:30", "Zona monumental · 2 adultos", "Total: 36,00 €", "Mostrar el QR en la entrada"], code: "PG-771204" }) },
    { name: "Entradas Cueva de Nerja.png", docType: "ticket", attachTo: "Cuevas de Nerja", blob: await png({ title: "Cueva de Nerja", lines: ["Sábado 10 oct 2026 · 10:00", "Visita cultural · 2 adultos", "Total: 30,00 €", "Estacionamiento incluido"], code: "CN-55012" }) },
    // Trip documents
    { name: "Seguro de viaje AXA.pdf", docType: "insurance", blob: pdf({ brand: "AXA ASSISTANCE", title: "Certificado de seguro de viaje", subtitle: "Schengen · Cobertura médica y equipaje", rows: [["Asegurados", "Alberto Chávez Bautista · Ximena Bautista"], ["Vigencia", "27 sep 2026 - 12 oct 2026"], ["Destino", "España (zona Schengen)"], ["Gastos médicos", "Hasta 60.000 €"], ["Asistencia 24 h", "+34 91 000 0000"], ["Póliza", "AXA-TRV-2026-448120"]], footer: "Presentar este certificado en el control migratorio si se solicita." }) },
    { name: "Itinerario general España 2026.pdf", docType: "other", blob: pdf({ brand: "TRAVIO", title: "España 2026", subtitle: "27 sep - 11 oct · 15 días", rows: [["27 sep", "Vuelo AM 23 a Barcelona"], ["28 sep - 2 oct", "Barcelona · Casa Bonay"], ["2 - 5 oct", "Madrid · Only YOU Boutique"], ["5 - 8 oct", "Sevilla · Casa 1800"], ["8 - 11 oct", "Málaga · Molina Lario"], ["11 oct", "Regreso AGP-MAD-MEX con Iberia"]], footer: "Emergencias en España: 112" }) },
  ];

  const results = [];
  for (const doc of docs) results.push(await upload(doc));
  console.table(results);
  return results;
})();
