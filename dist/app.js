const tibetanDigits = "༠༡༢༣༤༥༦༧༨༩";
const expressionEl = document.querySelector("#expression");
const resultEl = document.querySelector("#result");
const errorEl = document.querySelector("#error");
const historyPanel = document.querySelector("#historyPanel");
const historyButton = document.querySelector("#historyButton");
const historyList = document.querySelector("#historyList");
let expression = "";
let history = [];
let calculated = false;
let lastResult = "";

const toArabic = value => [...value].map(char => {
  const index = tibetanDigits.indexOf(char);
  return index >= 0 ? String(index) : char;
}).join("");

const toTibetan = value => String(value).replace(/\d/g, digit => tibetanDigits[Number(digit)]);
const pretty = value => toTibetan(value.replace(/\*/g, "×").replace(/\//g, " ÷ ").replace(/-/g, " − ").replace(/\+/g, " + "));

const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};

class Rational {
  constructor(numerator, denominator = 1n) {
    if (denominator === 0n) throw new Error("Cannot divide by zero");
    const divisor = gcd(numerator, denominator);
    const sign = denominator < 0n ? -1n : 1n;
    this.numerator = numerator / divisor * sign;
    this.denominator = denominator / divisor * sign;
  }

  static parse(source) {
    const [whole, fraction] = source.split(".");
    if (fraction === undefined) return new Rational(BigInt(whole));
    const denominator = 10n ** BigInt(fraction.length);
    return new Rational(BigInt(`${whole || "0"}${fraction}`), denominator);
  }

  add(other) { return new Rational(this.numerator * other.denominator + other.numerator * this.denominator, this.denominator * other.denominator); }
  subtract(other) { return new Rational(this.numerator * other.denominator - other.numerator * this.denominator, this.denominator * other.denominator); }
  multiply(other) { return new Rational(this.numerator * other.numerator, this.denominator * other.denominator); }
  divide(other) { return new Rational(this.numerator * other.denominator, this.denominator * other.numerator); }
  negate() { return new Rational(-this.numerator, this.denominator); }
  abs() { return this.numerator < 0n ? this.negate() : this; }
  compare(other) { return this.numerator * other.denominator < other.numerator * this.denominator ? -1 : this.numerator * other.denominator > other.numerator * this.denominator ? 1 : 0; }

  toDecimal(maxFractionDigits = 10) {
    const negative = this.numerator < 0n;
    const numerator = negative ? -this.numerator : this.numerator;
    let whole = numerator / this.denominator;
    let remainder = numerator % this.denominator;
    if (remainder === 0n) return `${negative ? "-" : ""}${whole}`;

    const scale = 10n ** BigInt(maxFractionDigits);
    let fraction = remainder * scale / this.denominator;
    remainder = remainder * scale % this.denominator;
    if (remainder * 2n >= this.denominator) fraction += 1n;
    if (fraction >= scale) { whole += 1n; fraction -= scale; }

    const fractionText = fraction.toString().padStart(maxFractionDigits, "0").replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole}${fractionText ? `.${fractionText}` : ""}`;
  }
}

const formatWithGrouping = value => {
  const negative = value.startsWith("-");
  const [whole, fraction] = (negative ? value.slice(1) : value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
};

function tokenize(source) {
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g) || [];
  if (tokens.join("") !== source.replace(/\s/g, "")) throw new Error("Unsupported character");
  return tokens;
}

function evaluate(source) {
  const tokens = tokenize(toArabic(source));
  let position = 0;
  const parseExpression = () => {
    let value = parseTerm();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const op = tokens[position++]; const right = parseTerm(); value = op === "+" ? value.add(right) : value.subtract(right);
    }
    return value;
  };
  const parseTerm = () => {
    let value = parseUnary();
    while (["*", "/"].includes(tokens[position])) {
      const op = tokens[position++]; const right = parseUnary();
      value = op === "*" ? value.multiply(right) : value.divide(right);
    }
    return value;
  };
  const parseUnary = () => {
    if (tokens[position] === "+") { position++; return parseUnary(); }
    if (tokens[position] === "-") { position++; return parseUnary().negate(); }
    return parsePostfix();
  };
  const parsePostfix = () => {
    let value = parsePrimary();
    while (tokens[position] === "%") { position++; value = value.divide(new Rational(100n)); }
    return value;
  };
  const parsePrimary = () => {
    if (tokens[position] === "(") {
      position++; const value = parseExpression();
      if (tokens[position++] !== ")") throw new Error("Missing closing parenthesis");
      return value;
    }
    const token = tokens[position++];
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error("Complete the expression");
    return Rational.parse(token);
  };
  if (!tokens.length) throw new Error("Enter a calculation");
  const value = parseExpression();
  if (position !== tokens.length) throw new Error("Check the expression");
  if (value.abs().compare(new Rational(10n ** 100n)) > 0) throw new Error("Result is outside supported range");
  if (value.abs().compare(new Rational(1n, 10n ** 12n)) < 0) return "0";
  return value.toDecimal(10);
}

function render() {
  expressionEl.textContent = expression ? pretty(expression) : "༠";
  if (!expression) resultEl.textContent = "༠";
  errorEl.textContent = "";
}

function calculate() {
  try {
    const original = expression;
    const raw = evaluate(expression);
    const formatted = formatWithGrouping(raw);
    const result = toTibetan(formatted);
    resultEl.textContent = result;
    history.unshift({ expression: pretty(original), result });
    history = history.slice(0, 8);
    lastResult = raw;
    calculated = true;
    renderHistory();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

function renderHistory() {
  historyList.innerHTML = history.length ? history.map(item => `<li><span>${item.expression}</span><b>${item.result}</b></li>`).join("") : "<li>No calculations yet.</li>";
}

function append(value, operation = false) {
  const isPercent = value === "%";
  if (calculated) {
    expression = operation || isPercent ? lastResult : "";
    if (!operation && !isPercent) resultEl.textContent = "༠";
  }
  calculated = false;

  const endsWithNumber = /[0-9༠-༩]$/.test(expression);
  const startsWithNumber = /^[0-9༠-༩.]/.test(value);

  if (startsWithNumber && expression.endsWith("%")) {
    if (expression.length + value.length + 1 > 64) return;
    expression += `*${value}`;
    render();
    return;
  }

  if (isPercent) {
    if (!endsWithNumber && !expression.endsWith(")")) return;
    if (expression.length < 64) expression += value;
    render();
    return;
  }

  if (operation) {
    if (!expression && value !== "-") return;
    if (/[+\-*/]$/.test(expression)) {
      expression = `${expression.slice(0, -1)}${value}`;
      render();
      return;
    }
  }

  if (expression.length + value.length <= 64) expression += value;
  render();
}

document.querySelector(".keypad").addEventListener("click", event => {
  const key = event.target.closest("button"); if (!key) return;
  if (key.dataset.action === "clear") { expression = ""; lastResult = ""; calculated = false; resultEl.textContent = "༠"; render(); return; }
  if (key.dataset.action === "backspace") { expression = expression.slice(0, -1); calculated = false; render(); return; }
  if (key.dataset.action === "equals") { calculate(); return; }
  append(key.dataset.value, key.classList.contains("operator"));
});

document.addEventListener("keydown", event => {
  if (/^[0-9()%.]$/.test(event.key)) append(event.key);
  else if (/^[+\-*/]$/.test(event.key)) append(event.key, true);
  else if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculate(); }
  else if (event.key === "Backspace") { expression = expression.slice(0, -1); calculated = false; render(); }
  else if (event.key === "Escape") { expression = ""; lastResult = ""; calculated = false; resultEl.textContent = "༠"; render(); }
});

historyButton.addEventListener("click", () => {
  const open = historyPanel.hidden; historyPanel.hidden = !open; historyButton.setAttribute("aria-expanded", String(open));
});
document.querySelector("#clearHistory").addEventListener("click", () => { history = []; renderHistory(); });
document.querySelector("[data-scroll-history]").addEventListener("click", () => document.querySelector("#calculator").scrollIntoView({ behavior: "smooth" }));
render();
