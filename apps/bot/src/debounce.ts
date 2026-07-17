// รวมข้อความหลายๆ ข้อความที่ลูกค้าพิมพ์ติดกันภายในเวลาสั้นๆ ให้กลายเป็นบริบทเดียว
// ก่อนเรียก AI ตอบ เพื่อไม่ให้บอทตอบข้อความแรกไปก่อนที่ลูกค้าจะพิมพ์ข้อความถัดไปจบ
// (ถ้ามีข้อความใหม่เข้ามาในคีย์เดียวกันก่อนครบเวลา จะยกเลิกตัวจับเวลาเดิมและเริ่มนับใหม่)
const pendingTimers = new Map<string, NodeJS.Timeout>();

export function scheduleDebounced(key: string, delayMs: number, callback: () => void | Promise<void>): void {
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(key);
    Promise.resolve(callback()).catch((err) => {
      console.error(`[Debounce] Error running callback for key "${key}":`, err);
    });
  }, delayMs);

  pendingTimers.set(key, timer);
}

export function cancelDebounced(key: string): void {
  const existing = pendingTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingTimers.delete(key);
  }
}
