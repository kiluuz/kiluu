import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface Participant {
  socketId: string
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  accentColor: string
  isHost: boolean
}

interface Room {
  id: string
  code: string
  name: string
  animeId: string
  animeTitle: string
  episodeId: string
  episodeNumber: number
  episodeTitle: string
  videoUrl: string
  coverImage: string | null
  createdAt: number
  participants: Map<string, Participant>
  playback: {
    isPlaying: boolean
    position: number // seconds at lastUpdate
    lastUpdate: number // timestamp ms
    playbackRate: number
  }
  reactions: Array<{ id: string; emoji: string; username: string; at: number }>
}

const rooms = new Map<string, Room>()

const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function roomToPublic(room: Room) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    animeId: room.animeId,
    animeTitle: room.animeTitle,
    episodeId: room.episodeId,
    episodeNumber: room.episodeNumber,
    episodeTitle: room.episodeTitle,
    videoUrl: room.videoUrl,
    coverImage: room.coverImage,
    createdAt: room.createdAt,
    hostName: Array.from(room.participants.values()).find(p => p.isHost)?.displayName || 'Host',
    participantCount: room.participants.size,
  }
}

function getSyncedPosition(room: Room): number {
  if (!room.playback.isPlaying) return room.playback.position
  const elapsed = (Date.now() - room.playback.lastUpdate) / 1000
  return room.playback.position + elapsed * room.playback.playbackRate
}

// Clean up rooms empty for over 2 hours
setInterval(() => {
  const now = Date.now()
  for (const [id, room] of rooms) {
    if (room.participants.size === 0 && now - room.createdAt > 2 * 60 * 60 * 1000) {
      rooms.delete(id)
    }
  }
}, 5 * 60 * 1000)

io.on('connection', (socket) => {
  console.log(`[watch-party] connected: ${socket.id}`)

  socket.on('room:list', (callback: (data: { rooms: unknown[] }) => void) => {
    const list = Array.from(rooms.values())
      .filter(r => r.participants.size > 0)
      .sort((a, b) => b.participants.size - a.participants.size)
      .slice(0, 30)
      .map(roomToPublic)
    if (typeof callback === 'function') callback({ rooms: list })
  })

  socket.on('room:create', (data: {
    user: { id: string; username: string; displayName: string; avatarUrl: string | null; accentColor: string },
    room: { name: string; animeId: string; animeTitle: string; episodeId: string; episodeNumber: number; episodeTitle: string; videoUrl: string; coverImage: string | null }
  }, callback: (res: { ok: boolean; room?: unknown; error?: string }) => void) => {
    try {
      const { user, room } = data
      if (!user?.id || !room?.videoUrl) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Invalid room data' })
        return
      }
      const id = Math.random().toString(36).slice(2, 11)
      const newRoom: Room = {
        id,
        code: genCode(),
        name: room.name?.slice(0, 60) || `${user.displayName}'s Watch Party`,
        animeId: room.animeId,
        animeTitle: room.animeTitle,
        episodeId: room.episodeId,
        episodeNumber: room.episodeNumber,
        episodeTitle: room.episodeTitle,
        videoUrl: room.videoUrl,
        coverImage: room.coverImage,
        createdAt: Date.now(),
        participants: new Map(),
        playback: { isPlaying: false, position: 0, lastUpdate: Date.now(), playbackRate: 1 },
        reactions: [],
      }
      rooms.set(id, newRoom)

      const participant: Participant = {
        socketId: socket.id,
        userId: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl,
        accentColor: user.accentColor || '#a855f7',
        isHost: true,
      }
      newRoom.participants.set(socket.id, participant)
      socket.join(id)
      socket.data.roomId = id

      if (typeof callback === 'function') callback({ ok: true, room: roomToPublic(newRoom) })
      io.emit('rooms:updated')
      console.log(`[watch-party] room created ${newRoom.code} by ${user.username}`)
    } catch (e) {
      console.error('[watch-party] create error', e)
      if (typeof callback === 'function') callback({ ok: false, error: 'Failed to create room' })
    }
  })

  socket.on('room:join', (data: { code: string; user: { id: string; username: string; displayName: string; avatarUrl: string | null; accentColor: string } }, callback: (res: { ok: boolean; room?: unknown; state?: unknown; participants?: unknown[]; error?: string }) => void) => {
    try {
      const code = String(data?.code || '').trim().toUpperCase()
      const room = Array.from(rooms.values()).find(r => r.code === code)
      if (!room) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room not found. Check the code.' })
        return
      }
      const user = data.user
      if (!user?.id) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Invalid user' })
        return
      }

      const existingSameUser = Array.from(room.participants.values()).find(p => p.userId === user.id && p.socketId !== socket.id)
      if (existingSameUser) {
        room.participants.delete(existingSameUser.socketId)
      }

      const participant: Participant = {
        socketId: socket.id,
        userId: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl,
        accentColor: user.accentColor || '#a855f7',
        isHost: !Array.from(room.participants.values()).some(p => p.isHost),
      }
      room.participants.set(socket.id, participant)
      socket.join(room.id)
      socket.data.roomId = room.id

      const state = { ...room.playback, position: getSyncedPosition(room) }
      if (typeof callback === 'function') callback({ ok: true, room: roomToPublic(room), state, participants: Array.from(room.participants.values()) })

      socket.to(room.id).emit('party:user-joined', { participant })
      io.emit('rooms:updated')
      console.log(`[watch-party] ${user.username} joined room ${room.code}`)
    } catch (e) {
      console.error('[watch-party] join error', e)
      if (typeof callback === 'function') callback({ ok: false, error: 'Failed to join room' })
    }
  })

  socket.on('room:leave', () => {
    leaveRoom(socket)
  })

  // Host-controlled playback sync
  socket.on('playback:play', (data: { position?: number }) => {
    const room = rooms.get(socket.data.roomId)
    console.log(`[watch-party] playback:play from ${socket.id} room=${socket.data.roomId} found=${!!room}`)
    if (!room) return
    room.playback = {
      isPlaying: true,
      position: typeof data?.position === 'number' ? data.position : getSyncedPosition(room),
      lastUpdate: Date.now(),
      playbackRate: room.playback.playbackRate,
    }
    socket.to(room.id).emit('playback:play', { position: room.playback.position })
  })

  socket.on('playback:pause', (data: { position?: number }) => {
    const room = rooms.get(socket.data.roomId)
    if (!room) return
    room.playback = {
      isPlaying: false,
      position: typeof data?.position === 'number' ? data.position : getSyncedPosition(room),
      lastUpdate: Date.now(),
      playbackRate: room.playback.playbackRate,
    }
    socket.to(room.id).emit('playback:pause', { position: room.playback.position })
  })

  socket.on('playback:seek', (data: { position: number }) => {
    const room = rooms.get(socket.data.roomId)
    if (!room || typeof data?.position !== 'number') return
    room.playback.position = data.position
    room.playback.lastUpdate = Date.now()
    socket.to(room.id).emit('playback:seek', { position: data.position })
  })

  socket.on('playback:rate', (data: { rate: number }) => {
    const room = rooms.get(socket.data.roomId)
    if (!room || typeof data?.rate !== 'number') return
    const current = getSyncedPosition(room)
    room.playback.position = current
    room.playback.playbackRate = data.rate
    room.playback.lastUpdate = Date.now()
    socket.to(room.id).emit('playback:rate', { rate: data.rate, position: current })
  })

  // Request current state (for catching up / re-sync)
  socket.on('playback:sync', (callback: (state: unknown) => void) => {
    const room = rooms.get(socket.data.roomId)
    if (!room) {
      if (typeof callback === 'function') callback(null)
      return
    }
    if (typeof callback === 'function') {
      callback({ ...room.playback, position: getSyncedPosition(room) })
    }
  })

  // Reactions (no text chat - emoji only by design)
  socket.on('reaction', (data: { emoji: string }) => {
    const room = rooms.get(socket.data.roomId)
    if (!room) return
    const participant = room.participants.get(socket.id)
    if (!participant) return
    const emoji = String(data?.emoji || '❤️').slice(0, 8)
    const reaction = { id: Math.random().toString(36).slice(2), emoji, username: participant.displayName, at: Date.now() }
    room.reactions.push(reaction)
    if (room.reactions.length > 100) room.reactions.shift()
    io.to(room.id).emit('reaction', reaction)
  })

  socket.on('disconnect', () => {
    leaveRoom(socket)
    console.log(`[watch-party] disconnected: ${socket.id}`)
  })

  socket.on('error', (error: unknown) => {
    console.error(`[watch-party] socket error (${socket.id}):`, error)
  })
})

function leaveRoom(socket: { id: string; data: { roomId?: string } }) {
  const roomId = socket.data?.roomId
  if (!roomId) return
  const room = rooms.get(roomId)
  if (!room) return
  const participant = room.participants.get(socket.id)
  room.participants.delete(socket.id)
  socket.leave(roomId)

  if (room.participants.size === 0) {
    // Keep room alive briefly; cleanup handled by interval
  } else {
    // Reassign host if needed
    if (participant?.isHost) {
      const next = Array.from(room.participants.values())[0]
      if (next) {
        next.isHost = true
        io.to(room.id).emit('party:host-changed', { hostId: next.socketId, hostName: next.displayName })
      }
    }
    io.to(room.id).emit('party:user-left', { socketId: socket.id, username: participant?.displayName })
  }
  io.emit('rooms:updated')
}

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[watch-party] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
