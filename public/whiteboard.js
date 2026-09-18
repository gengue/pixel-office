import { furn } from './world.js'
import { roomAt } from './rooms.js'

const [, x, y, w, h] = furn.find(([type]) => type === 'board')
export const BOARD = { x: x + w / 2, y: y + h }
export const BOARD_WIDTH = 1000
export const BOARD_HEIGHT = 560

export function nearBoard(position) {
  return roomAt(position) === roomAt(BOARD) && position.y >= BOARD.y && Math.hypot(position.x - BOARD.x, position.y - BOARD.y) <= 140
}

export function validBoardOperation(op) {
  const point = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= BOARD_WIDTH && p[1] >= 0 && p[1] <= BOARD_HEIGHT
  if (!op || typeof op.id !== 'string' || !/^[a-f0-9-]{36}$/.test(op.id) || !/^#[a-f0-9]{6}$/i.test(op.color) || !Number.isInteger(op.size) || op.size < 1 || op.size > 48) return false
  if (op.tool === 'text') return point(op.at) && typeof op.text === 'string' && op.text.trim().length > 0 && op.text.length <= 200
  return ['pen', 'eraser'].includes(op.tool) && Array.isArray(op.points) && op.points.length > 0 && op.points.length <= 512 && op.points.every(point)
}

export function paintBoardOperation(ctx, op) {
  ctx.save()
  ctx.fillStyle = ctx.strokeStyle = op.tool === 'eraser' ? '#ffffff' : op.color
  if (op.tool === 'text') {
    ctx.font = `${op.size}px sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(op.text, ...op.at)
  } else {
    ctx.lineWidth = op.size
    ctx.lineCap = ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(...op.points[0])
    for (const p of op.points) ctx.lineTo(...p)
    ctx.stroke()
    if (op.points.length === 1) {
      ctx.beginPath()
      ctx.arc(...op.points[0], op.size / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

export function setupWhiteboard({ getPosition, send, isConnected, stopMoving }) {
  const $ = (id) => document.getElementById(id)
  const dialog = $('whiteboardDialog'), canvas = $('whiteboardCanvas'), status = $('whiteboardStatus')
  const ctx = canvas.getContext('2d')
  const saved = document.createElement('canvas')
  saved.width = canvas.width = BOARD_WIDTH
  saved.height = canvas.height = BOARD_HEIGHT
  const backing = saved.getContext('2d')
  const pending = new Map()
  let ready = false, stroke = null, pointer = null
  function render() {
    ctx.drawImage(saved, 0, 0)
    for (const op of pending.values()) paintBoardOperation(ctx, op)
    if (stroke) paintBoardOperation(ctx, stroke)
  }
  function submit(op) {
    if (!ready || !isConnected() || !nearBoard(getPosition())) return
    pending.set(op.id, op)
    status.textContent = 'Saving…'
    send({ t: 'board-operation', op })
    render()
  }
  function finish() {
    if (!stroke) return
    const op = stroke
    stroke = null
    pointer = null
    submit(op)
  }
  const point = (event) => {
    const rect = canvas.getBoundingClientRect()
    return [Math.max(0, Math.min(BOARD_WIDTH, Math.round((event.clientX - rect.left) * BOARD_WIDTH / rect.width))), Math.max(0, Math.min(BOARD_HEIGHT, Math.round((event.clientY - rect.top) * BOARD_HEIGHT / rect.height)))]
  }
  function operation() {
    const tool = $('boardTool').value
    return { id: crypto.randomUUID(), tool, color: $('boardColor').value, size: tool === 'text' ? 28 : tool === 'eraser' ? 32 : Number($('boardSize').value) }
  }
  $('boardTool').onchange = () => { $('boardTextLabel').hidden = $('boardTool').value !== 'text' }
  canvas.onpointerdown = (event) => {
    if (event.button !== 0 || pointer !== null || !ready || !isConnected()) return
    const op = operation()
    if (op.tool === 'text') {
      op.at = point(event)
      op.text = $('boardText').value.trim()
      if (!op.text) { $('boardText').focus(); return }
      submit(op)
    } else {
      pointer = event.pointerId
      stroke = { ...op, points: [point(event)] }
      canvas.setPointerCapture(pointer)
      render()
    }
  }
  canvas.onpointermove = (event) => {
    if (!stroke || event.pointerId !== pointer) return
    const p = point(event), last = stroke.points.at(-1)
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return
    stroke.points.push(p)
    if (stroke.points.length === 512) {
      const next = { ...stroke, id: crypto.randomUUID(), points: [p] }
      submit(stroke)
      stroke = next
    }
    render()
  }
  canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = finish
  $('boardOpen').onclick = () => {
    if (!isConnected() || !nearBoard(getPosition())) return
    stopMoving()
    const p = getPosition()
    send({ t: 'move', x: Math.round(p.x), y: Math.round(p.y) })
    ready = false
    status.textContent = 'Loading shared board…'
    dialog.showModal()
    send({ t: 'board-open' })
  }
  $('boardClose').onclick = () => dialog.close()
  dialog.addEventListener('close', () => { finish(); send({ t: 'board-close' }); ready = false })
  return {
    update() {
      const near = isConnected() && nearBoard(getPosition())
      $('boardOpen').hidden = !near
      if (!near && dialog.open) dialog.close()
    },
    onMessage(message) {
      if (message.t === 'board-error') {
        pending.delete(message.id)
        status.textContent = message.message
      } else if (message.t === 'board-state') {
        backing.fillStyle = '#ffffff'
        backing.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
        pending.clear()
        for (const op of message.operations) paintBoardOperation(backing, op)
        ready = true
        status.textContent = 'All changes saved · shared with everyone'
      } else if (message.t === 'board-operation') {
        paintBoardOperation(backing, message.op)
        pending.delete(message.op.id)
        status.textContent = pending.size ? 'Saving…' : 'All changes saved · shared with everyone'
      }
      render()
    },
    reset() {
      ready = false
      stroke = null
      pointer = null
      pending.clear()
      if (dialog.open) dialog.close()
      $('boardOpen').hidden = true
    },
  }
}
