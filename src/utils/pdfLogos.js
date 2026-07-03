/**
 * pdfLogos.js — letterhead, watermark, footer for all PDFs
 */

const cache = {}

async function loadImageAsBase64(src) {
  if (cache[src]) return cache[src]
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth  || img.width  || 200
      canvas.height = img.naturalHeight || img.height || 200
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      try { resolve(canvas.toDataURL('image/png')) } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function loadWatermarkBase64(src, opacity = 0.09) {
  const key = src + '_wm_' + opacity
  if (cache[key]) return cache[key]
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const size = 500
      const canvas = document.createElement('canvas')
      canvas.width  = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, size, size)
      ctx.globalAlpha = opacity
      ctx.drawImage(img, 0, 0, size, size)
      try {
        cache[key] = canvas.toDataURL('image/png')
        resolve(cache[key])
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function loadFontAsBase64(src) {
  if (cache['font_' + src]) return cache['font_' + src]
  try {
    const resp  = await fetch(src)
    const buf   = await resp.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
    const b64 = btoa(bin)
    cache['font_' + src] = b64
    return b64
  } catch { return null }
}

async function registerSundayGrapes(doc) {
  const b64 = await loadFontAsBase64('/Sunday Grapes.ttf')
  if (b64) {
    try {
      doc.addFileToVFS('SundayGrapes.ttf', b64)
      doc.addFont('SundayGrapes.ttf', 'SundayGrapes', 'normal')
    } catch {}
  }
}

export async function loadPdfLogos() {
  const [trustLogo, schoolLogo, trustLogoWatermark] = await Promise.all([
    loadImageAsBase64('/Trust Logo.avif'),
    loadImageAsBase64('/image.png'),
    loadWatermarkBase64('/Trust Logo.avif', 0.09),
  ])
  return { trustLogo, schoolLogo, trustLogoWatermark }
}

/**
 * Draw letterhead. Returns Y where body content starts.
 *
 * Header layout (A4 = 210mm wide, header = 44mm tall):
 *   [TrustLogo 30×30] [SchoolLogo 30×30]  |  ANAND SPECIAL SCHOOL (Sunday Grapes)
 *                                          |  Mngd. By Anand Rehabilitation Trust
 *   ─── vertical divider at 80mm ─────────┼──────────────────────────────────────
 *                                          |  Email / Contact / Address (right half)
 *
 * Sunday Grapes is a large display font — used at small point size (9–10pt)
 * so it renders at the correct visual weight without wrapping.
 */
export async function drawLetterhead(doc, logos, docTitle = '', subtitle = '') {
  const W = doc.internal.pageSize.width    // 210mm A4
  const H = doc.internal.pageSize.height   // 297mm A4

  await registerSundayGrapes(doc)

  // ── HEADER ────────────────────────────────────────────────────────────────
  const HEADER_H = 44

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, HEADER_H, 'F')

  // Logos (30×30mm each, 3mm gap between, 4mm from left edge)
  const LS = 30
  const LP = 4
  if (logos.trustLogo)  { try { doc.addImage(logos.trustLogo,  'PNG', LP,         7, LS, LS) } catch {} }
  if (logos.schoolLogo) { try { doc.addImage(logos.schoolLogo, 'PNG', LP+LS+3, 7, LS, LS) } catch {} }

  // Vertical divider at 68mm (just after logos)
  const DIV = LP + LS * 2 + 3 + 1   // ≈ 68mm
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.4)
  doc.line(DIV, 5, DIV, HEADER_H - 3)

  // ── LEFT TEXT: school name + trust name ───────────────────────────────────
  // Sunday Grapes is a display font — at 9pt it's visually about 18pt in helvetica
  // We keep it on ONE line by using a small point size
  const LX = LP  // align text under logos (left-aligned)

  doc.setTextColor(10, 90, 40)
  try {
    doc.setFont('SundayGrapes', 'normal')
    doc.setFontSize(9)   // Sunday Grapes renders large — 9pt ≈ looks like 18–20pt
  } catch {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
  }
  doc.text('ANAND SPECIAL SCHOOL', LX, 6)

  doc.setTextColor(170, 25, 25)
  try {
    doc.setFont('SundayGrapes', 'normal')
    doc.setFontSize(6)   // 6pt Sunday Grapes ≈ 11–12pt visually
  } catch {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
  }
  doc.text('Mngd. By Anand Rehabilitation Trust', LX, 13)

  // ── RIGHT: contact details ────────────────────────────────────────────────
  const CX = DIV + 4   // contact block left edge

  doc.setFont('helvetica', 'normal')

  // Email row
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(10, 90, 40)
  doc.text('Email:', CX, 12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  doc.text('anandrehabilitationtrust@gmail.com', CX + 13, 12)

  // Contact row
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(10, 90, 40)
  doc.text('Contact:', CX, 19)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  doc.text('+91-9467041819, +91-261-4550090', CX + 16, 19)

  // Address rows
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(10, 90, 40)
  doc.text('Address:', CX, 26)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  doc.text('101, Shavion Shopping Paradise, Gaurav Path Road,', CX + 5, 32)
  doc.text('Palanpur, Surat - 395009 (Gujarat-India)',          CX + 5, 38)

  // ── ACCENT STRIPE ─────────────────────────────────────────────────────────
  doc.setFillColor(10, 90, 40)
  doc.rect(0, HEADER_H, W * 0.70, 2.5, 'F')
  doc.setFillColor(170, 25, 25)
  doc.rect(W * 0.70, HEADER_H, W * 0.30, 2.5, 'F')

  let y = HEADER_H + 2.5

  // ── DOCUMENT TITLE BAND ───────────────────────────────────────────────────
  if (docTitle) {
    doc.setFillColor(22, 55, 122)
    doc.rect(0, y, W, 13, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(docTitle, W / 2, y + 9, { align: 'center' })
    y += 13
  }

  // ── SUBTITLE ──────────────────────────────────────────────────────────────
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(70, 70, 70)
    doc.text(subtitle, W / 2, y + 6, { align: 'center' })
    y += 11
  }

  const contentStartY = y + 3

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const FOOTER_TOP = H - 22
  doc.setFillColor(255, 255, 255)
  doc.rect(0, FOOTER_TOP, W, 22, 'F')

  doc.setFillColor(10, 90, 40)
  doc.rect(0, FOOTER_TOP, W * 0.70, 1.5, 'F')
  doc.setFillColor(170, 25, 25)
  doc.rect(W * 0.70, FOOTER_TOP, W * 0.30, 1.5, 'F')

  doc.setFillColor(248, 248, 248)
  doc.rect(0, FOOTER_TOP + 1.5, W, 20.5, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text('(Registered for 12A and 80G)', W / 2, FOOTER_TOP + 7, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(170, 25, 25)
  doc.text(
    'Trust Regi. No. 6047  ||  NITI Ayog Regi. No. HR/2025/0491254  ||  Ministry of MSME Regi. No. GJ-22-0462933',
    W / 2, FOOTER_TOP + 12, { align: 'center' }
  )

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(40, 40, 40)
  doc.text(
    'Registered Address: 186, Barsi Nagar, Jind Bypass Chowk, Rohtak - 124001 (Haryana - India)',
    W / 2, FOOTER_TOP + 18, { align: 'center' }
  )

  // ── WATERMARK — body area only ─────────────────────────────────────────────
  if (logos.trustLogoWatermark) {
    try {
      const bodyH  = FOOTER_TOP - contentStartY
      const wmSize = Math.min(W * 0.60, bodyH * 0.72)
      const wmX    = (W - wmSize) / 2
      const wmY    = contentStartY + (bodyH - wmSize) / 2
      doc.addImage(logos.trustLogoWatermark, 'PNG', wmX, wmY, wmSize, wmSize)
    } catch {}
  }

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  return contentStartY
}

export async function drawLetterheadFooter(_doc) { /* no-op shim */ }
export async function drawPdfHeader(doc, logos, _n, _s) {
  return drawLetterhead(doc, logos, _s || '', '')
}
