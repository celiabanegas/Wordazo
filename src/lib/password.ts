// Reglas de contraseña: obligatorias 10 caracteres, una mayúscula y un número; recomendado un símbolo.
export function checkPassword(p: string) {
  const rules = [
    { ok: p.length >= 10, missing: 'Usa al menos 10 caracteres', required: true },
    { ok: /[A-ZÁÉÍÓÚÑ]/.test(p), missing: 'Añade una mayúscula', required: true },
    { ok: /[0-9]/.test(p), missing: 'Añade un número', required: true },
    { ok: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(p), missing: 'Añade un símbolo (!?#) para que sea más segura', required: false },
  ];
  const valid = rules.filter((r) => r.required).every((r) => r.ok);
  let score = rules.filter((r) => r.ok).length;
  if (p.length >= 14 && valid) score = 4;
  const label = !p ? '' : score <= 1 ? 'Débil' : score === 2 ? 'Mejorable' : score === 3 ? 'Casi segura' : 'Segura';
  const next = rules.find((r) => !r.ok)?.missing ?? '';
  return { valid, score, label, next };
}

/** dd/mm/aaaa → aaaa-mm-dd, o null si la fecha no es válida */
export function parseBirthdate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1 || y < 1900 || dt > new Date()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Va poniendo las barras mientras se escribe la fecha */
export function maskDate(s: string) {
  const d = s.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(' / ');
}

export function ageFrom(iso: string) {
  const b = new Date(iso + 'T00:00:00');
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
