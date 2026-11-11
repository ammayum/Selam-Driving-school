import QRCode from "qrcode";

export type CardDetails = { name: string; qualification: string; phone: string; instagram: string; facebook: string; location: string; booking_url: string };
export type CardSide = "front" | "back";
const escape = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
function text(value: string, x: number, y: number, size: number, width: number, fill = "#fff5dd", weight = 400, serif = false) {
  const family = serif ? "Georgia" : "Arial";
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = `${weight} ${size}px ${family}`;
  const fit = context.measureText(value).width > width ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"${fit}>${escape(value)}</text>`;
}
function qr(url: string) {
  if (!/^https?:\/\//i.test(url) || url.length > 300) throw new Error("Enter a valid HTTP or HTTPS booking link (maximum 300 characters).");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Enter a complete booking link, including the website address."); }
  if (parsed.username || parsed.password) throw new Error("Do not include login credentials in a printed booking link.");
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  let path = "";
  for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) if (modules.data[y * modules.size + x]) path += `M${x + 4},${y + 4}h1v1h-1z`;
  return `<svg x="623" y="318" width="180" height="180" viewBox="0 0 ${modules.size + 8} ${modules.size + 8}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="#241818" shape-rendering="crispEdges"/></svg>`;
}
export function cardSvg(details: CardDetails, side: CardSide): string {
  const open = '<svg xmlns="http://www.w3.org/2000/svg" width="85mm" height="55mm" viewBox="0 0 850 550" role="img"><title>Selam Driving School business card</title><defs><linearGradient id="red" x2="1" y2="1"><stop stop-color="#f02225"/><stop offset="1" stop-color="#c70820"/></linearGradient></defs><rect width="850" height="550" fill="url(#red)"/>';
  if (side === "front") return open +
    '<path d="M-140,-80 C440,25 -135,272 188,640" stroke="#f7c735" stroke-width="194" fill="none"/><path d="M-140,-80 C440,25 -135,272 188,640" stroke="#414049" stroke-width="177" fill="none"/><path d="M-140,-80 C440,25 -135,272 188,640" stroke="#f8f3e8" stroke-width="151" fill="none"/><path d="M-140,-80 C440,25 -135,272 188,640" stroke="#414049" stroke-width="143" fill="none"/><path d="M-140,-80 C440,25 -135,272 188,640" stroke="#fff9ed" stroke-width="12" stroke-dasharray="54 54" fill="none"/>' +
    text("YOUR JOURNEY TO", 287, 97, 31, 516) + text("PEACEFUL DRIVING", 287, 150, 31, 516) + text("STARTS HERE.", 287, 203, 31, 516) + text("LEARN TO DRIVE,", 287, 256, 31, 516) + text("THE SELAM WAY.", 287, 309, 33, 516, "#fff5dd", 700) +
    text("Get in touch", 287, 390, 29, 310, "#ffdf4b") + text("to book a lesson now.", 287, 432, 25, 310, "#ffdf4b") + text("SCAN TO BOOK", 640, 524, 17, 170, "#fff5dd", 700) + qr(details.booking_url) + '</svg>';
  const icons = [
    '<rect x="-8" y="-13" width="16" height="26" rx="3" fill="none" stroke="#d31825" stroke-width="3"/><path d="M-3 9h6" stroke="#d31825" stroke-width="2"/>',
    '<rect x="-12" y="-12" width="24" height="24" rx="6" fill="none" stroke="#d31825" stroke-width="3"/><circle r="6" fill="none" stroke="#d31825" stroke-width="3"/><circle cx="7" cy="-7" r="2" fill="#d31825"/>',
    '<path d="M4 15V1h6l1-7H4v-3q0-4 6-3v-7q-14-2-14 10v3h-5v7h5v14z" fill="#d31825"/>',
    '<path d="M0 15S-12 2-12-5a12 12 0 0 1 24 0C12 2 0 15 0 15Z" fill="#d31825"/><circle cy="-5" r="4" fill="#fff5dd"/>'
  ];
  let rows = "";
  [details.phone, details.instagram, details.facebook, details.location].forEach((value, i) => { if (value) rows += `<g transform="translate(326 ${240 + i * 66})"><circle r="23" fill="#fff5dd"/>${icons[i]}</g>` + text(value, 365, 250 + i * 66, 27, 440); });
  return open + '<path d="M302 62v91" stroke="#ffdf4b" stroke-width="5"/>' + text(details.name.toUpperCase(), 330, 102, 35, 473, "#ffdf4b", 700) + text(details.qualification, 330, 142, 24, 473) +
    '<g transform="translate(65 255)" fill="#fff5dd"><path d="M49 38C15 7 5-32 1-55c25 17 39 31 54 48C48-38 55-61 61-82c16 30 27 57 19 84 18-1 25 12 19 24L71 45 5 58 40 38Z"/><path d="M85 7l29 5-23 7Z"/></g>' +
    text("SeLam", 43, 363, 73, 240, "#ffdf4b", 700, true) + text("DRIVING SCHOOL", 55, 396, 17, 222, "#fff5dd", 700) + rows + '</svg>';
}
export async function downloadCard(details: CardDetails, side: CardSide, format: "svg" | "png") {
  const svg = cardSvg(details, side);
  let blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  if (format === "png") {
    const image = new Image();
    // A data URL also works under the application's strict img-src policy.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 2550; canvas.height = 1650;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Image export is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image export failed")), "image/png"));
  }
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = `selam-${details.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}-${side}.${format}`;
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
