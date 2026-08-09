export function io() {
  const noop = () => {};
  return { on: noop, off: noop, removeAllListeners: noop, disconnect: noop, io: { on: noop } };
}
export default { io };
