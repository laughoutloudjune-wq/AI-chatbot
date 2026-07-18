// แบ่งคำตอบยาวๆ ของ AI ออกเป็นข้อความสั้นๆ หลายข้อความ (bubble) ให้ดูเหมือนคนพิมพ์แชทจริง
// (ทยอยพิมพ์หลายข้อความสั้น) แทนที่จะส่งเป็นก้อนข้อความยาวก้อนเดียว
// ขั้นแรกแบ่งตามย่อหน้าที่โมเดลเว้นบรรทัดไว้อยู่แล้ว ถ้าย่อหน้าไหนยังยาวเกินไป (โมเดลไม่ทำตามกฎ)
// จะตัดแบ่งเพิ่มโดยพยายามตัดที่ช่องว่างเพื่อไม่ให้คำขาดกลางคำ
const DEFAULT_MAX_BUBBLE_CHARS = 150;

export function splitIntoBubbles(text: string, maxBubbleChars: number = DEFAULT_MAX_BUBBLE_CHARS): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .flatMap((p) => p.split('\n'))
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const bubbles: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxBubbleChars) {
      bubbles.push(paragraph);
      continue;
    }

    let remaining = paragraph;
    while (remaining.length > maxBubbleChars) {
      let cutAt = remaining.lastIndexOf(' ', maxBubbleChars);
      if (cutAt <= 0) cutAt = maxBubbleChars;
      bubbles.push(remaining.slice(0, cutAt).trim());
      remaining = remaining.slice(cutAt).trim();
    }
    if (remaining.length > 0) bubbles.push(remaining);
  }

  return bubbles.length > 0 ? bubbles : [text.trim()];
}
