export interface MathEvalResult {
  ok: boolean;
  value?: number;
  formatted?: string;
  error?: string;
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' | '%' }
  | { type: 'fn'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(raw: string): Token[] {
  const normalized = raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');

  const tokens: Token[] = [];
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let numStr = '';
      let dotCount = 0;
      while (i < normalized.length && ((normalized[i] >= '0' && normalized[i] <= '9') || normalized[i] === '.')) {
        if (normalized[i] === '.') dotCount += 1;
        if (dotCount > 1) throw new Error('Número inválido');
        numStr += normalized[i];
        i += 1;
      }
      const parsed = Number(numStr);
      if (!Number.isFinite(parsed)) throw new Error('Número fuera de rango');
      // Implicit multiplication e.g. 2pi or 2(3)
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.type === 'rparen' || prev.type === 'num')) {
        tokens.push({ type: 'op', value: '*' });
      }
      tokens.push({ type: 'num', value: parsed });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let ident = '';
      while (i < normalized.length && /[a-zA-Z]/.test(normalized[i])) {
        ident += normalized[i].toLowerCase();
        i += 1;
      }
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.type === 'num' || prev.type === 'rparen')) {
        tokens.push({ type: 'op', value: '*' });
      }
      if (ident === 'pi') {
        tokens.push({ type: 'num', value: Math.PI });
      } else if (ident === 'e') {
        tokens.push({ type: 'num', value: Math.E });
      } else if (['sin', 'cos', 'tan', 'sqrt', 'log', 'ln', 'abs'].includes(ident)) {
        tokens.push({ type: 'fn', value: ident });
      } else {
        throw new Error(`Función desconocida: ${ident}`);
      }
      continue;
    }

    if (ch === '(') {
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.type === 'num' || prev.type === 'rparen')) {
        tokens.push({ type: 'op', value: '*' });
      }
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '%') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    throw new Error(`Carácter no válido: ${ch}`);
  }

  return tokens;
}

export function formatMathNumber(val: number): string {
  if (!Number.isFinite(val)) return 'Error';
  if (Math.abs(val) < 1e-12) return '0';
  const cleaned = Number(val.toPrecision(12));
  if (Math.abs(cleaned) >= 1e12 || (Math.abs(cleaned) > 0 && Math.abs(cleaned) < 1e-7)) {
    return cleaned.toExponential(6);
  }
  return String(cleaned);
}

export function evaluateMathExpression(rawExpr: string, ansValue = 0): MathEvalResult {
  const trimmed = rawExpr.trim().replace(/\bANS\b/gi, `(${ansValue})`);
  if (!trimmed) {
    return { ok: false, error: 'Ingresá una operación' };
  }

  try {
    const tokens = tokenize(trimmed);
    let pos = 0;

    const peek = (): Token | undefined => tokens[pos];
    const consume = (): Token => tokens[pos++];

    const parseExpression = (): number => {
      let left = parseTerm();
      while (true) {
        const t = peek();
        if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
          consume();
          const right = parseTerm();
          left = t.value === '+' ? left + right : left - right;
        } else {
          break;
        }
      }
      return left;
    };

    const parseTerm = (): number => {
      let left = parsePower();
      while (true) {
        const t = peek();
        if (t?.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
          consume();
          const right = parsePower();
          if (t.value === '*') left *= right;
          else if (t.value === '/') {
            if (right === 0) throw new Error('División por cero');
            left /= right;
          } else {
            left = left % right;
          }
        } else {
          break;
        }
      }
      return left;
    };

    const parsePower = (): number => {
      const base = parseUnary();
      const t = peek();
      if (t?.type === 'op' && t.value === '^') {
        consume();
        const exponent = parsePower();
        return Math.pow(base, exponent);
      }
      return base;
    };

    const parseUnary = (): number => {
      const t = peek();
      if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
        consume();
        const val = parseUnary();
        return t.value === '-' ? -val : val;
      }
      return parsePrimary();
    };

    const parsePrimary = (): number => {
      const t = peek();
      if (!t) throw new Error('Expresión incompleta');

      if (t.type === 'num') {
        consume();
        return t.value;
      }

      if (t.type === 'fn') {
        const fnName = t.value;
        consume();
        const arg = parsePrimary();
        switch (fnName) {
          case 'sin':
            return Math.sin((arg * Math.PI) / 180);
          case 'cos':
            return Math.cos((arg * Math.PI) / 180);
          case 'tan':
            return Math.tan((arg * Math.PI) / 180);
          case 'sqrt':
            if (arg < 0) throw new Error('Raíz de número negativo');
            return Math.sqrt(arg);
          case 'log':
            if (arg <= 0) throw new Error('Logaritmo no definido');
            return Math.log10(arg);
          case 'ln':
            if (arg <= 0) throw new Error('Logaritmo no definido');
            return Math.log(arg);
          case 'abs':
            return Math.abs(arg);
          default:
            throw new Error('Función no soportada');
        }
      }

      if (t.type === 'lparen') {
        consume();
        const inner = parseExpression();
        const close = peek();
        if (close?.type !== 'rparen') {
          throw new Error('Falta cerrar paréntesis');
        }
        consume();
        return inner;
      }

      throw new Error('Sintaxis inválida');
    };

    const value = parseExpression();
    if (pos < tokens.length) {
      throw new Error('Sintaxis inválida');
    }
    if (!Number.isFinite(value)) {
      throw new Error('Resultado indefinido');
    }
    return {
      ok: true,
      value,
      formatted: formatMathNumber(value),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de cálculo',
    };
  }
}

export type UnitCategoryId =
  | 'longitud'
  | 'masa'
  | 'temperatura'
  | 'datos'
  | 'velocidad'
  | 'tiempo';

export interface UnitDefinition {
  id: string;
  label: string;
  factorToBase: number;
}

export interface UnitCategory {
  id: UnitCategoryId;
  label: string;
  units: UnitDefinition[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'longitud',
    label: 'Longitud',
    units: [
      { id: 'm', label: 'Metros (m)', factorToBase: 1 },
      { id: 'km', label: 'Kilómetros (km)', factorToBase: 1000 },
      { id: 'cm', label: 'Centímetros (cm)', factorToBase: 0.01 },
      { id: 'mm', label: 'Milímetros (mm)', factorToBase: 0.001 },
      { id: 'mi', label: 'Millas (mi)', factorToBase: 1609.344 },
      { id: 'ft', label: 'Pies (ft)', factorToBase: 0.3048 },
      { id: 'in', label: 'Pulgadas (in)', factorToBase: 0.0254 },
    ],
  },
  {
    id: 'masa',
    label: 'Masa / Peso',
    units: [
      { id: 'kg', label: 'Kilogramos (kg)', factorToBase: 1 },
      { id: 'g', label: 'Gramos (g)', factorToBase: 0.001 },
      { id: 'mg', label: 'Miligramos (mg)', factorToBase: 0.000001 },
      { id: 'lb', label: 'Libras (lb)', factorToBase: 0.45359237 },
      { id: 'oz', label: 'Onzas (oz)', factorToBase: 0.028349523125 },
      { id: 't', label: 'Toneladas (t)', factorToBase: 1000 },
    ],
  },
  {
    id: 'temperatura',
    label: 'Temperatura',
    units: [
      { id: 'c', label: 'Celsius (°C)', factorToBase: 1 },
      { id: 'f', label: 'Fahrenheit (°F)', factorToBase: 1 },
      { id: 'k', label: 'Kelvin (K)', factorToBase: 1 },
    ],
  },
  {
    id: 'datos',
    label: 'Datos Digitales',
    units: [
      { id: 'mb', label: 'Megabytes (MB)', factorToBase: 1024 * 1024 },
      { id: 'gb', label: 'Gigabytes (GB)', factorToBase: 1024 * 1024 * 1024 },
      { id: 'tb', label: 'Terabytes (TB)', factorToBase: 1024 * 1024 * 1024 * 1024 },
      { id: 'kb', label: 'Kilobytes (KB)', factorToBase: 1024 },
      { id: 'b', label: 'Bytes (B)', factorToBase: 1 },
    ],
  },
  {
    id: 'velocidad',
    label: 'Velocidad',
    units: [
      { id: 'kmh', label: 'km/h', factorToBase: 1 / 3.6 },
      { id: 'ms', label: 'm/s', factorToBase: 1 },
      { id: 'mph', label: 'mph', factorToBase: 0.44704 },
      { id: 'kn', label: 'Nudos (kn)', factorToBase: 0.514444 },
    ],
  },
  {
    id: 'tiempo',
    label: 'Tiempo',
    units: [
      { id: 'min', label: 'Minutos (min)', factorToBase: 60 },
      { id: 's', label: 'Segundos (s)', factorToBase: 1 },
      { id: 'h', label: 'Horas (h)', factorToBase: 3600 },
      { id: 'd', label: 'Días (d)', factorToBase: 86400 },
      { id: 'sem', label: 'Semanas', factorToBase: 604800 },
    ],
  },
];

export function convertUnitValue(
  categoryId: UnitCategoryId,
  fromId: string,
  toId: string,
  value: number
): number {
  if (!Number.isFinite(value)) return 0;
  if (categoryId === 'temperatura') {
    let celsius = value;
    if (fromId === 'f') celsius = (value - 32) * (5 / 9);
    else if (fromId === 'k') celsius = value - 273.15;

    if (toId === 'f') return celsius * (9 / 5) + 32;
    if (toId === 'k') return celsius + 273.15;
    return celsius;
  }

  const cat = UNIT_CATEGORIES.find((c) => c.id === categoryId) || UNIT_CATEGORIES[0];
  const fromUnit = cat.units.find((u) => u.id === fromId) || cat.units[0];
  const toUnit = cat.units.find((u) => u.id === toId) || cat.units[1] || cat.units[0];
  const baseVal = value * fromUnit.factorToBase;
  return baseVal / toUnit.factorToBase;
}

export function generateSecurePassword(options: {
  length: number;
  includeUpper: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  pinOnly: boolean;
}): string {
  const len = Math.max(4, Math.min(32, options.length));
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  const syms = '!@#$%&*?-_+=';

  let charset = options.pinOnly ? nums : lower;
  if (!options.pinOnly) {
    if (options.includeUpper) charset += upper;
    if (options.includeNumbers) charset += nums;
    if (options.includeSymbols) charset += syms;
  }
  if (!charset) charset = lower + nums;

  const bytes = new Uint32Array(len);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i += 1) {
      bytes[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }

  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}
