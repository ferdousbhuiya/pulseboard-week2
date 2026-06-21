import { ReactNode, useMemo, useState, useRef } from 'react'
import { saveAs } from 'file-saver'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import JSZip from 'jszip'
import { apiUrl } from '../config/api'

function toBytes(file: File) {
  return file.arrayBuffer()
}

function toPdfBlob(bytes: Uint8Array<ArrayBufferLike>) {
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

function slugifyName(value: string) {
  return value.toLowerCase().replace(/\s+/g, '-')
}

function readImages(files: File[]) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
    )
  )
}

function FilePicker({
  accept,
  multiple,
  onFiles
}: {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
}) {
  console.log('FilePicker rendering with accept:', accept)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.click()
    }
  }

  return (
    <div className="file-picker">
      <input
        ref={inputRef}
        type="file"
        title="Select file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => onFiles(Array.from(e.target.files || []))}
      />
      <button onClick={handleClick} className="file-picker-button">
        📁 Choose File
      </button>
    </div>
  )
}

function ToolShell({ title, children }: { title: string; children: ReactNode }) {
  console.log('ToolShell rendering with title:', title)
  return (
    <section className="tool-page">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

async function postFormData(url: string, data: FormData) {
  const response = await fetch(apiUrl(url), {
    method: 'POST',
    body: data
  })

  const contentType = response.headers.get('content-type') || ''
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { error?: string }
      throw new Error(payload.error || 'Request failed')
    }
    throw new Error(await response.text())
  }

  return response
}

function BackendBinaryTool({
  title,
  endpoint,
  accept,
  outputName,
  includePassword = false,
  extraFields,
  note
}: {
  title: string
  endpoint: string
  accept: string
  outputName: string
  includePassword?: boolean
  extraFields?: Record<string, string>
  note?: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const run = async () => {
    if (!file) return
    setBusy(true)
    setStatus('Processing...')
    try {
      const data = new FormData()
      data.append('file', file)
      if (includePassword) {
        data.append('password', password)
      }
      if (extraFields) {
        Object.entries(extraFields).forEach(([key, value]) => data.append(key, value))
      }
      const response = await postFormData(endpoint, data)
      const blob = await response.blob()
      saveAs(blob, outputName)
      setStatus('Done')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell title={title}>
      {note ? <p className="hint">{note}</p> : null}
      <FilePicker accept={accept} onFiles={(files) => setFile(files[0] || null)} />
      {includePassword ? (
        <div className="row">
          <input
            type="password"
            title="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      ) : null}
      <div className="row">
        <button onClick={run} disabled={!file || busy || (includePassword && !password.trim())}>
          Run
        </button>
      </div>
      {status ? <p className="hint">{status}</p> : null}
    </ToolShell>
  )
}

function TextResultTool({ title, endpoint, accept, note }: { title: string; endpoint: string; accept: string; note?: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')

  const run = async () => {
    if (!file) return
    setBusy(true)
    setStatus('Processing...')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await postFormData(endpoint, form)
      const payload = (await response.json()) as { text?: string }
      setText(payload.text || '')
      setStatus('Done')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const saveText = () => {
    saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${slugifyName(title)}.txt`)
  }

  return (
    <ToolShell title={title}>
      {note ? <p className="hint">{note}</p> : null}
      <FilePicker accept={accept} onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <button onClick={run} disabled={!file || busy}>
          Extract
        </button>
        <button onClick={saveText} disabled={!text}>
          Download TXT
        </button>
      </div>
      {status ? <p className="hint">{status}</p> : null}
      {text ? <textarea title="Extracted text" value={text} onChange={(e) => setText(e.target.value)} /> : null}
    </ToolShell>
  )
}

function NoticeTool({ title, message }: { title: string; message: string }) {
  return (
    <ToolShell title={title}>
      <p className="hint">{message}</p>
    </ToolShell>
  )
}

function CropTool() {
  const [file, setFile] = useState<File | null>(null)
  const [marginPercent, setMarginPercent] = useState(5)

  const run = async () => {
    if (!file) return
    const doc = await PDFDocument.load(await toBytes(file))
    doc.getPages().forEach((page) => {
      const { width, height } = page.getSize()
      const marginX = (width * marginPercent) / 100
      const marginY = (height * marginPercent) / 100
      const cropWidth = Math.max(1, width - marginX * 2)
      const cropHeight = Math.max(1, height - marginY * 2)
      page.setCropBox(marginX, marginY, cropWidth, cropHeight)
    })
    saveAs(toPdfBlob(await doc.save()), 'cropped.pdf')
  }

  return (
    <ToolShell title="Crop PDF">
      <p className="hint">Applies equal crop margin to all pages.</p>
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <input
          type="number"
          title="Crop margin percent"
          min={0}
          max={40}
          value={marginPercent}
          onChange={(e) => setMarginPercent(Math.min(40, Math.max(0, Number(e.target.value) || 0)))}
        />
        <button onClick={run} disabled={!file}>
          Crop
        </button>
      </div>
    </ToolShell>
  )
}

function RedactTool() {
  const [file, setFile] = useState<File | null>(null)
  const [rules, setRules] = useState('1,0.1,0.2,0.6,0.1')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const parseRules = () => {
    const entries = rules
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(',').map((item) => Number(item.trim())))
      .filter((parts) => parts.length === 5 && parts.every((n) => Number.isFinite(n)))
      .map(([page, x, y, width, height]) => ({ page, x, y, width, height }))

    return entries
  }

  const run = async () => {
    if (!file) return
    const redactions = parseRules()
    if (!redactions.length) {
      setStatus('Enter at least one valid rule.')
      return
    }

    setBusy(true)
    setStatus('Processing...')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('redactions', JSON.stringify(redactions))

      const response = await postFormData('/api/redact-pdf', form)
      saveAs(await response.blob(), 'redacted.pdf')
      setStatus('Done')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Redaction failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell title="Redact PDF">
      <p className="hint">Rule format per line: page,x,y,width,height (normalized 0..1 from top-left).</p>
      <p className="hint">Example: 1,0.1,0.2,0.6,0.1</p>
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <textarea
        title="Redaction rules"
        placeholder="1,0.1,0.2,0.6,0.1"
        value={rules}
        onChange={(e) => setRules(e.target.value)}
      />
      <div className="row">
        <button onClick={run} disabled={!file || busy}>
          Redact
        </button>
      </div>
      {status ? <p className="hint">{status}</p> : null}
    </ToolShell>
  )
}

function ScanToPdfTool() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!files.length) return
    setBusy(true)
    const pdf = await PDFDocument.create()
    const imageData = await readImages(files)
    for (const dataUrl of imageData) {
      const image = dataUrl.startsWith('data:image/png') ? await pdf.embedPng(dataUrl) : await pdf.embedJpg(dataUrl)
      const page = pdf.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    }
    saveAs(toPdfBlob(await pdf.save()), 'scan-to-pdf.pdf')
    setBusy(false)
  }

  return (
    <ToolShell title="Scan to PDF">
      <p className="hint">Use your camera or scanner app to capture images, then convert to PDF.</p>
      <input
        type="file"
        title="Scan images"
        accept="image/*"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />
      <div className="row">
        <button onClick={run} disabled={!files.length || busy}>
          Build PDF
        </button>
      </div>
    </ToolShell>
  )
}

function MergeTool() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!files.length) return
    setBusy(true)
    const out = await PDFDocument.create()
    for (const file of files) {
      const src = await PDFDocument.load(await toBytes(file))
      const pages = await out.copyPages(src, src.getPageIndices())
      pages.forEach((p) => out.addPage(p))
    }
    saveAs(toPdfBlob(await out.save()), 'merged.pdf')
    setBusy(false)
  }

  return (
    <ToolShell title="Merge PDF">
      <FilePicker accept=".pdf,application/pdf" multiple onFiles={setFiles} />
      <div className="row">
        <button disabled={busy || files.length < 2} onClick={run}>
          Merge {files.length} files
        </button>
      </div>
    </ToolShell>
  )
}

function SplitTool() {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'single' | 'range'>('single')
  const [range, setRange] = useState('1-1')

  const run = async () => {
    if (!file) return
    const src = await PDFDocument.load(await toBytes(file))
    if (mode === 'single') {
      const zip = new JSZip()
      for (let index = 0; index < src.getPageCount(); index += 1) {
        const out = await PDFDocument.create()
        const [copied] = await out.copyPages(src, [index])
        out.addPage(copied)
        zip.file(`page-${index + 1}.pdf`, await out.save())
      }
      saveAs(await zip.generateAsync({ type: 'blob' }), 'split-pages.zip')
      return
    }

    const [startRaw, endRaw] = range.split('-')
    const start = Math.max(1, Number(startRaw || 1))
    const end = Math.min(src.getPageCount(), Number(endRaw || src.getPageCount()))
    const out = await PDFDocument.create()
    const indices = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => i + start - 1)
    const copied = await out.copyPages(src, indices)
    copied.forEach((p) => out.addPage(p))
    saveAs(toPdfBlob(await out.save()), `pages-${start}-${end}.pdf`)
  }

  return (
    <ToolShell title="Split PDF">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <select title="Split mode" value={mode} onChange={(e) => setMode(e.target.value as 'single' | 'range')}>
          <option value="single">Every page to separate file</option>
          <option value="range">Custom page range</option>
        </select>
        {mode === 'range' ? <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="1-5" /> : null}
        <button onClick={run} disabled={!file}>
          Split
        </button>
      </div>
    </ToolShell>
  )
}

function RotateTool() {
  const [file, setFile] = useState<File | null>(null)
  const [angle, setAngle] = useState(90)

  const run = async () => {
    if (!file) return
    const doc = await PDFDocument.load(await toBytes(file))
    doc.getPages().forEach((page) => {
      page.setRotation(degrees(angle))
    })
    saveAs(toPdfBlob(await doc.save()), 'rotated.pdf')
  }

  return (
    <ToolShell title="Rotate PDF">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <select title="Rotation angle" value={angle} onChange={(e) => setAngle(Number(e.target.value))}>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
        <button onClick={run} disabled={!file}>
          Rotate
        </button>
      </div>
    </ToolShell>
  )
}

function OrganizeTool({ removeOnly = false }: { removeOnly?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [order, setOrder] = useState('1,2,3')

  const run = async () => {
    if (!file) return
    const src = await PDFDocument.load(await toBytes(file))
    const out = await PDFDocument.create()
    const max = src.getPageCount()
    const chosen = order
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= max)
      .map((value) => value - 1)

    const finalIndices = removeOnly
      ? Array.from({ length: max }, (_, index) => index).filter((index) => !chosen.includes(index))
      : chosen

    const pages = await out.copyPages(src, finalIndices)
    pages.forEach((page) => out.addPage(page))
    saveAs(toPdfBlob(await out.save()), removeOnly ? 'removed-pages.pdf' : 'organized.pdf')
  }

  return (
    <ToolShell title={removeOnly ? 'Remove Pages' : 'Organize PDF'}>
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <p className="hint">
        {removeOnly
          ? 'Enter page numbers to remove (comma-separated), e.g. 2,5'
          : 'Enter desired page order (comma-separated), e.g. 3,1,2'}
      </p>
      <div className="row">
        <input title="Page list" placeholder="1,2,3" value={order} onChange={(e) => setOrder(e.target.value)} />
        <button onClick={run} disabled={!file}>
          Apply
        </button>
      </div>
    </ToolShell>
  )
}

function ExtractPagesTool() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState('1,2')

  const run = async () => {
    if (!file) return
    const src = await PDFDocument.load(await toBytes(file))
    const out = await PDFDocument.create()
    const max = src.getPageCount()
    const indices = pages
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= max)
      .map((value) => value - 1)
    const copied = await out.copyPages(src, indices)
    copied.forEach((p) => out.addPage(p))
    saveAs(toPdfBlob(await out.save()), 'extracted-pages.pdf')
  }

  return (
    <ToolShell title="Extract Pages">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="1,3,5" />
        <button onClick={run} disabled={!file}>
          Extract
        </button>
      </div>
    </ToolShell>
  )
}

function CompressTool() {
  const [file, setFile] = useState<File | null>(null)

  const run = async () => {
    if (!file) return
    const src = await PDFDocument.load(await toBytes(file))
    const saved = await src.save({ useObjectStreams: true })
    saveAs(toPdfBlob(saved), 'compressed.pdf')
  }

  return (
    <ToolShell title="Compress PDF">
      <p className="hint">Uses lightweight object stream optimization in-browser.</p>
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <button onClick={run} disabled={!file}>
          Compress
        </button>
      </div>
    </ToolShell>
  )
}

function WatermarkTool() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('CONFIDENTIAL')

  const run = async () => {
    if (!file) return
    const doc = await PDFDocument.load(await toBytes(file))
    const font = await doc.embedFont(StandardFonts.Helvetica)
    doc.getPages().forEach((page) => {
      const { width, height } = page.getSize()
      page.drawText(text, {
        x: width * 0.2,
        y: height * 0.45,
        size: 36,
        font,
        rotate: degrees(35),
        color: rgb(0.8, 0.1, 0.1),
        opacity: 0.25
      })
    })
    saveAs(toPdfBlob(await doc.save()), 'watermarked.pdf')
  }

  return (
    <ToolShell title="Add Watermark">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Watermark text" />
        <button onClick={run} disabled={!file || !text.trim()}>
          Add Watermark
        </button>
      </div>
    </ToolShell>
  )
}

function PageNumberTool() {
  const [file, setFile] = useState<File | null>(null)

  const run = async () => {
    if (!file) return
    const doc = await PDFDocument.load(await toBytes(file))
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const total = doc.getPageCount()
    doc.getPages().forEach((page, index) => {
      const { width } = page.getSize()
      page.drawText(`${index + 1}/${total}`, {
        x: width - 70,
        y: 18,
        size: 11,
        font,
        color: rgb(0.15, 0.15, 0.15)
      })
    })
    saveAs(toPdfBlob(await doc.save()), 'numbered.pdf')
  }

  return (
    <ToolShell title="Add Page Numbers">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <button onClick={run} disabled={!file}>
          Add Page Numbers
        </button>
      </div>
    </ToolShell>
  )
}

function MetadataTool() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')

  const run = async () => {
    if (!file) return
    const doc = await PDFDocument.load(await toBytes(file))
    if (title) doc.setTitle(title)
    if (author) doc.setAuthor(author)
    saveAs(toPdfBlob(await doc.save()), 'metadata-updated.pdf')
  }

  return (
    <ToolShell title="Edit PDF Metadata">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <button onClick={run} disabled={!file}>
          Save Metadata
        </button>
      </div>
    </ToolShell>
  )
}

function JpgToPdfTool() {
  const [files, setFiles] = useState<File[]>([])

  const run = async () => {
    if (!files.length) return
    const pdf = await PDFDocument.create()
    const imageData = await readImages(files)
    for (const dataUrl of imageData) {
      const isPng = dataUrl.startsWith('data:image/png')
      const image = isPng
        ? await pdf.embedPng(dataUrl)
        : await pdf.embedJpg(dataUrl)
      const page = pdf.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    }
    saveAs(toPdfBlob(await pdf.save()), 'images-to-pdf.pdf')
  }

  return (
    <ToolShell title="JPG to PDF">
      <FilePicker accept="image/jpeg,image/jpg,image/png" multiple onFiles={setFiles} />
      <div className="row">
        <button onClick={run} disabled={!files.length}>
          Convert {files.length ? `(${files.length})` : ''}
        </button>
      </div>
    </ToolShell>
  )
}

function HtmlToPdfTool() {
  const [html, setHtml] = useState('<h1>Hello PDF</h1>')

  const run = async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const chunks = plain.match(/.{1,90}/g) || ['']
    chunks.forEach((chunk, index) => {
      page.drawText(chunk, {
        x: 30,
        y: 800 - index * 16,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1)
      })
    })
    saveAs(toPdfBlob(await doc.save()), 'html-to-pdf.pdf')
  }

  return (
    <ToolShell title="HTML to PDF">
      <p className="hint">Converts text content from HTML markup into a PDF document.</p>
      <textarea title="HTML input" placeholder="Paste HTML" value={html} onChange={(e) => setHtml(e.target.value)} />
      <div className="row">
        <button onClick={run}>Convert</button>
      </div>
    </ToolShell>
  )
}

function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!file) return
    setBusy(true)
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

    const bytes = await file.arrayBuffer()
    const doc = await pdfjs.getDocument({ data: bytes }).promise
    const zip = new JSZip()

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) continue
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport }).promise
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (blob) {
        zip.file(`page-${pageNumber}.jpg`, blob)
      }
    }

    saveAs(await zip.generateAsync({ type: 'blob' }), 'pdf-to-jpg.zip')
    setBusy(false)
  }

  return (
    <ToolShell title="PDF to JPG">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <button onClick={run} disabled={!file || busy}>
          Export JPGs
        </button>
      </div>
    </ToolShell>
  )
}

function CompareTool() {
  const [files, setFiles] = useState<File[]>([])
  const info = useMemo(() => {
    if (files.length !== 2) return ''
    return `${files[0].name} (${Math.round(files[0].size / 1024)} KB) vs ${files[1].name} (${Math.round(files[1].size / 1024)} KB)`
  }, [files])

  return (
    <ToolShell title="Compare PDF">
      <FilePicker accept=".pdf,application/pdf" multiple onFiles={setFiles} />
      <p className="hint">
        Browser mode comparison shows file-size/name diff. For visual page-by-page diff, connect this route to a backend
        diff engine.
      </p>
      {info ? <p>{info}</p> : null}
    </ToolShell>
  )
}

function SignTool() {
  const [file, setFile] = useState<File | null>(null)
  const [signText, setSignText] = useState('Signed electronically')

  const run = async () => {
    if (!file) return
    const doc = await PDFDocument.load(await toBytes(file))
    const font = await doc.embedFont(StandardFonts.HelveticaOblique)
    const page = doc.getPages()[doc.getPageCount() - 1]
    page.drawText(signText, {
      x: 40,
      y: 40,
      size: 14,
      font,
      color: rgb(0, 0, 0.6)
    })
    saveAs(toPdfBlob(await doc.save()), 'signed.pdf')
  }

  return (
    <ToolShell title="Sign PDF">
      <FilePicker accept=".pdf,application/pdf" onFiles={(files) => setFile(files[0] || null)} />
      <div className="row">
        <input title="Signature text" placeholder="Signature text" value={signText} onChange={(e) => setSignText(e.target.value)} />
        <button onClick={run} disabled={!file}>
          Sign
        </button>
      </div>
    </ToolShell>
  )
}

function WordToPdfTool() {
  const [file, setFile] = useState<File | null>(null)
  const [textPreview, setTextPreview] = useState('')

  const onFile = async (files: File[]) => {
    const selected = files[0] || null
    setFile(selected)
    if (!selected) {
      setTextPreview('')
      return
    }
    try {
      const mammoth = await import('mammoth')
      const data = await selected.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: data })
      setTextPreview(result.value.slice(0, 1000))
    } catch {
      setTextPreview('Preview unavailable for this document.')
    }
  }

  const run = async () => {
    if (!file) return
    const text = textPreview || file.name
    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const chunks = text.match(/.{1,90}/g) || ['']
    chunks.forEach((chunk, index) => {
      page.drawText(chunk, {
        x: 30,
        y: 800 - index * 16,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1)
      })
    })
    saveAs(toPdfBlob(await doc.save()), 'word-to-pdf.pdf')
  }

  return (
    <ToolShell title="Word to PDF">
      <p className="hint">Client-side text-focused conversion for .docx files.</p>
      <FilePicker accept=".doc,.docx" onFiles={onFile} />
      {textPreview ? (
        <textarea
          title="Word preview"
          placeholder="Extracted text preview"
          value={textPreview}
          onChange={(e) => setTextPreview(e.target.value)}
        />
      ) : null}
      <div className="row">
        <button onClick={run} disabled={!file}>
          Convert
        </button>
      </div>
    </ToolShell>
  )
}

function SpreadsheetToPdfTool({ title }: { title: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')

  const onFile = async (files: File[]) => {
    const selected = files[0] || null
    setFile(selected)
    if (!selected) {
      setPreview('')
      return
    }
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await selected.arrayBuffer())
      const sheetName = workbook.SheetNames[0]
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
      setPreview(csv.slice(0, 1500))
    } catch {
      setPreview('Preview unavailable for this file.')
    }
  }

  const run = async () => {
    if (!file) return
    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842])
    const font = await doc.embedFont(StandardFonts.Courier)
    const text = (preview || file.name).replace(/\r/g, '')
    const lines = text.split('\n').slice(0, 45)
    lines.forEach((line, index) => {
      page.drawText(line.slice(0, 95), {
        x: 20,
        y: 820 - index * 17,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1)
      })
    })
    saveAs(toPdfBlob(await doc.save()), `${slugifyName(title)}.pdf`)
  }

  return (
    <ToolShell title={title}>
      <p className="hint">Table/text-focused conversion in browser.</p>
      <FilePicker accept=".xlsx,.xls,.csv" onFiles={onFile} />
      {preview ? (
        <textarea
          title="Table preview"
          placeholder="Sheet preview"
          value={preview}
          onChange={(e) => setPreview(e.target.value)}
        />
      ) : null}
      <div className="row">
        <button onClick={run} disabled={!file}>
          Convert
        </button>
      </div>
    </ToolShell>
  )
}

export function ToolRouter({ slug }: { slug: string }) {
  console.log('ToolRouter called with slug:', slug)
  switch (slug) {
    case 'merge-pdf':
      return <MergeTool />
    case 'split-pdf':
      return <SplitTool />
    case 'compress-pdf':
      return <CompressTool />
    case 'organize-pdf':
      return <OrganizeTool />
    case 'rotate-pdf':
      return <RotateTool />
    case 'extract-pages':
      return <ExtractPagesTool />
    case 'remove-pages':
      return <OrganizeTool removeOnly />
    case 'add-page-numbers':
      return <PageNumberTool />
    case 'add-watermark':
      return <WatermarkTool />
    case 'crop-pdf':
      return <CropTool />
    case 'edit-pdf':
      return (
        <NoticeTool
          title="Edit PDF"
          message="Full text/object-level PDF editing needs a dedicated editor engine. You can currently use rotate, crop, watermark, page numbers, metadata, and sign tools in this app."
        />
      )
    case 'edit-metadata':
      return <MetadataTool />
    case 'unlock-pdf':
      return (
        <BackendBinaryTool
          title="Unlock PDF"
          endpoint="/api/unlock-pdf"
          accept=".pdf,application/pdf"
          includePassword
          outputName="unlocked.pdf"
          note="Requires qpdf installed on your machine or QPDF_PATH configured."
        />
      )
    case 'protect-pdf':
      return (
        <BackendBinaryTool
          title="Protect PDF"
          endpoint="/api/protect-pdf"
          accept=".pdf,application/pdf"
          includePassword
          outputName="protected.pdf"
          note="Requires qpdf installed on your machine or QPDF_PATH configured."
        />
      )
    case 'jpg-to-pdf':
      return <JpgToPdfTool />
    case 'word-to-pdf':
      return <WordToPdfTool />
    case 'powerpoint-to-pdf':
      return (
        <BackendBinaryTool
          title="PowerPoint to PDF"
          endpoint="/api/convert"
          accept=".ppt,.pptx"
          outputName="powerpoint-to-pdf.pdf"
          extraFields={{ target: 'pdf' }}
          note="Uses local LibreOffice headless conversion (requires LibreOffice installed)."
        />
      )
    case 'excel-to-pdf':
      return <SpreadsheetToPdfTool title="Excel to PDF" />
    case 'html-to-pdf':
      return <HtmlToPdfTool />
    case 'pdf-to-jpg':
      return <PdfToJpgTool />
    case 'pdf-to-word':
      return (
        <BackendBinaryTool
          title="PDF to Word"
          endpoint="/api/convert"
          accept=".pdf,application/pdf"
          outputName="pdf-to-word.docx"
          extraFields={{ target: 'docx' }}
          note="Uses local LibreOffice conversion where supported by your installation."
        />
      )
    case 'pdf-to-powerpoint':
      return (
        <BackendBinaryTool
          title="PDF to PowerPoint"
          endpoint="/api/convert"
          accept=".pdf,application/pdf"
          outputName="pdf-to-powerpoint.pptx"
          extraFields={{ target: 'pptx' }}
          note="Uses local LibreOffice conversion where supported by your installation."
        />
      )
    case 'pdf-to-excel':
      return (
        <BackendBinaryTool
          title="PDF to Excel"
          endpoint="/api/convert"
          accept=".pdf,application/pdf"
          outputName="pdf-to-excel.xlsx"
          extraFields={{ target: 'xlsx' }}
          note="Uses local LibreOffice conversion where supported by your installation."
        />
      )
    case 'pdf-to-text':
      return <TextResultTool title="PDF to Text" endpoint="/api/pdf-to-text" accept=".pdf,application/pdf" />
    case 'pdf-to-pdfa':
      return (
        <NoticeTool
          title="PDF to PDF/A"
          message="PDF/A conversion requires a compliance conversion engine (typically Ghostscript/LibreOffice profiles). This route is included and ready for backend wiring."
        />
      )
    case 'redact-pdf':
      return <RedactTool />
    case 'translate-pdf':
      return (
        <NoticeTool
          title="Translate PDF"
          message="PDF translation requires external language/AI translation services plus layout reconstruction. This route is included for future backend integration."
        />
      )
    case 'repair-pdf':
      return (
        <BackendBinaryTool
          title="Repair PDF"
          endpoint="/api/repair-pdf"
          accept=".pdf,application/pdf"
          outputName="repaired.pdf"
          note="Requires qpdf installed on your machine or QPDF_PATH configured."
        />
      )
    case 'ocr-pdf':
      return (
        <TextResultTool
          title="OCR PDF"
          endpoint="/api/ocr"
          accept=".pdf,application/pdf,image/*"
          note="Best results with scanned image files; OCR runs via backend Tesseract.js."
        />
      )
    case 'scan-to-pdf':
      return <ScanToPdfTool />
    case 'compare-pdf':
      return <CompareTool />
    case 'sign-pdf':
      return <SignTool />
    default:
      return <ToolShell title="Tool not found">Unknown tool.</ToolShell>
  }
}
