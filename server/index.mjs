import express from 'express'
import cors from 'cors'
import multer from 'multer'
import * as pdfParse from 'pdf-parse'
import { PDFDocument, rgb } from 'pdf-lib'
import { createWorker } from 'tesseract.js'
import { mkdtemp, readFile, access, rm, writeFile, readdir } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const app = express()
const upload = multer({ storage: multer.memoryStorage() })

const allowedOrigins = String(process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('CORS origin not allowed'))
  }
}))
app.use(express.json())

function sanitizeBasename(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function findBinary(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

async function resolveQpdfBinary() {
  return findBinary([
    process.env.QPDF_PATH,
    'qpdf',
    'C:/Program Files/qpdf/bin/qpdf.exe',
    'C:/Program Files (x86)/qpdf/bin/qpdf.exe'
  ].filter(Boolean))
}

async function resolveLibreOfficeBinary() {
  return findBinary([
    process.env.LIBREOFFICE_PATH,
    'soffice',
    'C:/Program Files/LibreOffice/program/soffice.exe',
    'C:/Program Files (x86)/LibreOffice/program/soffice.exe'
  ].filter(Boolean))
}

async function resolvePdftoppmBinary() {
  return findBinary([
    process.env.PDFTOPPM_PATH,
    'pdftoppm',
    '/usr/bin/pdftoppm',
    'C:/Program Files/poppler/bin/pdftoppm.exe'
  ].filter(Boolean))
}

app.get('/api/health', async (_req, res) => {
  const qpdf = await resolveQpdfBinary()
  const soffice = await resolveLibreOfficeBinary()
  const pdftoppm = await resolvePdftoppmBinary()
  res.json({
    ok: true,
    binaries: {
      qpdf: Boolean(qpdf),
      libreoffice: Boolean(soffice),
      pdftoppm: Boolean(pdftoppm)
    }
  })
})

function parseRedactions(raw) {
  let parsed
  try {
    parsed = JSON.parse(String(raw || '[]'))
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map((entry) => ({
      page: Number(entry.page),
      x: Number(entry.x),
      y: Number(entry.y),
      width: Number(entry.width),
      height: Number(entry.height)
    }))
    .filter((entry) => Number.isFinite(entry.page)
      && Number.isFinite(entry.x)
      && Number.isFinite(entry.y)
      && Number.isFinite(entry.width)
      && Number.isFinite(entry.height)
      && entry.page >= 1
      && entry.x >= 0
      && entry.y >= 0
      && entry.width > 0
      && entry.height > 0)
}

app.post('/api/redact-pdf', upload.single('file'), async (req, res) => {
  const pdftoppm = await resolvePdftoppmBinary()
  if (!pdftoppm) {
    res.status(501).json({ error: 'pdftoppm binary not found. Install poppler-utils or set PDFTOPPM_PATH.' })
    return
  }

  const redactions = parseRedactions(req.body.redactions)
  if (!req.file || redactions.length === 0) {
    res.status(400).json({ error: 'file and redactions are required' })
    return
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pdf-toolkit-'))
  try {
    const stagePath = path.join(tempDir, 'stage-redacted.pdf')
    const source = await PDFDocument.load(req.file.buffer)

    redactions.forEach((entry) => {
      const index = entry.page - 1
      if (index < 0 || index >= source.getPageCount()) return
      const page = source.getPage(index)
      const { width, height } = page.getSize()

      const rectX = entry.x * width
      const rectWidth = Math.min(width - rectX, entry.width * width)
      const rectHeight = Math.min(height, entry.height * height)
      const topOriginY = entry.y * height
      const rectY = Math.max(0, height - topOriginY - rectHeight)

      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: Math.max(1, rectWidth),
        height: Math.max(1, rectHeight),
        color: rgb(0, 0, 0)
      })
    })

    await writeFile(stagePath, await source.save())

    const imagePrefix = path.join(tempDir, 'redacted-page')
    await execFileAsync(pdftoppm, ['-jpeg', '-r', '220', stagePath, imagePrefix])

    const generated = (await readdir(tempDir))
      .filter((name) => /^redacted-page-\d+\.jpg$/i.test(name))
      .sort((a, b) => {
        const numA = Number(a.match(/(\d+)/)?.[0] || 0)
        const numB = Number(b.match(/(\d+)/)?.[0] || 0)
        return numA - numB
      })

    if (generated.length === 0) {
      res.status(500).json({ error: 'No rasterized pages were generated for redaction output.' })
      return
    }

    const out = await PDFDocument.create()
    for (const imageName of generated) {
      const imagePath = path.join(tempDir, imageName)
      const imageBytes = await readFile(imagePath)
      const embedded = await out.embedJpg(imageBytes)
      const page = out.addPage([embedded.width, embedded.height])
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
    }

    const bytes = await out.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="redacted.pdf"')
    res.send(Buffer.from(bytes))
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Redaction failed' })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

app.post('/api/pdf-to-text', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Missing file' })
      return
    }
    const data = await pdfParse(req.file.buffer)
    res.json({ text: data.text || '' })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to extract text' })
  }
})

app.post('/api/ocr', upload.single('file'), async (req, res) => {
  let worker
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Missing file' })
      return
    }
    worker = await createWorker('eng')
    const out = await worker.recognize(req.file.buffer)
    res.json({ text: out.data?.text || '' })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'OCR failed' })
  } finally {
    if (worker) {
      await worker.terminate()
    }
  }
})

app.post('/api/protect-pdf', upload.single('file'), async (req, res) => {
  const qpdf = await resolveQpdfBinary()
  if (!qpdf) {
    res.status(501).json({ error: 'qpdf binary not found. Set QPDF_PATH or install qpdf.' })
    return
  }

  const password = String(req.body.password || '')
  if (!req.file || !password) {
    res.status(400).json({ error: 'file and password are required' })
    return
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pdf-toolkit-'))
  try {
    const inputPath = path.join(tempDir, sanitizeBasename(req.file.originalname || 'input.pdf'))
    const outputPath = path.join(tempDir, 'protected.pdf')
    await writeFile(inputPath, req.file.buffer)

    await execFileAsync(qpdf, [
      '--encrypt',
      password,
      password,
      '256',
      '--',
      inputPath,
      outputPath
    ])

    const out = await readFile(outputPath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="protected.pdf"')
    res.send(out)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Protection failed' })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

app.post('/api/unlock-pdf', upload.single('file'), async (req, res) => {
  const qpdf = await resolveQpdfBinary()
  if (!qpdf) {
    res.status(501).json({ error: 'qpdf binary not found. Set QPDF_PATH or install qpdf.' })
    return
  }

  const password = String(req.body.password || '')
  if (!req.file) {
    res.status(400).json({ error: 'file is required' })
    return
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pdf-toolkit-'))
  try {
    const inputPath = path.join(tempDir, sanitizeBasename(req.file.originalname || 'input.pdf'))
    const outputPath = path.join(tempDir, 'unlocked.pdf')
    await writeFile(inputPath, req.file.buffer)

    const args = password
      ? [`--password=${password}`, '--decrypt', inputPath, outputPath]
      : ['--decrypt', inputPath, outputPath]
    await execFileAsync(qpdf, args)

    const out = await readFile(outputPath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="unlocked.pdf"')
    res.send(out)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unlock failed' })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

app.post('/api/repair-pdf', upload.single('file'), async (req, res) => {
  const qpdf = await resolveQpdfBinary()
  if (!qpdf) {
    res.status(501).json({ error: 'qpdf binary not found. Set QPDF_PATH or install qpdf.' })
    return
  }

  if (!req.file) {
    res.status(400).json({ error: 'file is required' })
    return
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pdf-toolkit-'))
  try {
    const inputPath = path.join(tempDir, sanitizeBasename(req.file.originalname || 'input.pdf'))
    const outputPath = path.join(tempDir, 'repaired.pdf')
    await writeFile(inputPath, req.file.buffer)

    await execFileAsync(qpdf, ['--linearize', inputPath, outputPath])

    const out = await readFile(outputPath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="repaired.pdf"')
    res.send(out)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Repair failed' })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

app.post('/api/convert', upload.single('file'), async (req, res) => {
  const soffice = await resolveLibreOfficeBinary()
  if (!soffice) {
    res.status(501).json({ error: 'LibreOffice binary not found. Set LIBREOFFICE_PATH or install LibreOffice.' })
    return
  }

  const target = String(req.body.target || '').toLowerCase()
  if (!req.file || !target) {
    res.status(400).json({ error: 'file and target are required' })
    return
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pdf-toolkit-'))
  try {
    const inputName = sanitizeBasename(req.file.originalname || 'input.bin')
    const inputPath = path.join(tempDir, inputName)
    await writeFile(inputPath, req.file.buffer)

    await execFileAsync(soffice, ['--headless', '--convert-to', target, '--outdir', tempDir, inputPath], {
      windowsHide: true
    })

    const base = inputName.includes('.') ? inputName.slice(0, inputName.lastIndexOf('.')) : inputName
    const outputPath = path.join(tempDir, `${base}.${target}`)
    const out = await readFile(outputPath)

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${base}.${target}"`)
    res.send(out)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Conversion failed' })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

const port = Number(process.env.PORT || 8787)
app.listen(port, () => {
  console.log(`PDF Toolkit API listening on http://localhost:${port}`)
})
