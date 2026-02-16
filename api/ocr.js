/* global Buffer, process */

async function readRequestBuffer(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'OCR_SPACE_API_KEY is not configured on server' })
    return
  }

  try {
    const rawFilename = String(req.headers['x-filename'] || 'upload.bin')
    const filename = decodeURIComponent(rawFilename)
    const mime = String(req.headers['content-type'] || 'application/octet-stream')
    const fileBuffer = await readRequestBuffer(req)
    if (!fileBuffer.length) {
      res.status(400).json({ error: 'Empty file payload' })
      return
    }

    const form = new FormData()
    form.append('file', new Blob([fileBuffer], { type: mime }), filename)
    form.append('language', 'rus')
    form.append('isOverlayRequired', 'false')
    form.append('isTable', 'true')
    form.append('OCREngine', '2')

    const ocrResp = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: apiKey,
      },
      body: form,
    })

    const payload = await ocrResp.json()
    if (!ocrResp.ok) {
      res.status(ocrResp.status).json({
        error: payload?.ErrorMessage || payload?.ErrorDetails || `OCR HTTP ${ocrResp.status}`,
      })
      return
    }

    res.status(200).json(payload)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'OCR request failed' })
  }
}
