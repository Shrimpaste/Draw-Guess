export function applyCanvasEvent(room, event) {
  if (!room || room.code !== event.roomCode || room.round.id !== event.roundId) return room;
  if (event.version < room.canvasVersion) return room;
  if (event.type === "canvas:snapshot") {
    return { ...room, canvas: event.canvas, canvasEpoch: event.epoch, canvasVersion: event.version, canvasResetKey: (room.canvasResetKey || 0) + 1 };
  }
  if (event.version === room.canvasVersion) return room;
  if (event.epoch !== room.canvasEpoch || event.version !== room.canvasVersion + 1) throw new Error("CANVAS_DESYNC");
  const canvas = [...room.canvas];
  const index = canvas.findIndex((stroke) => stroke.id === event.stroke.id);
  if (event.stroke.offset !== (canvas[index]?.points.length || 0)) throw new Error("CANVAS_DESYNC");
  if (index < 0) {
    const { offset, ...stroke } = event.stroke;
    canvas.push(stroke);
  } else canvas[index] = { ...canvas[index], points: [...canvas[index].points, ...event.stroke.points] };
  return { ...room, canvas, canvasVersion: event.version };
}
