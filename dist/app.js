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
const pretty = value => toTibetan(value.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/-/g, " − ").replace(/\+/g, " + "));

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
      const op = tokens[position++]; const right = parseTerm(); value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  const parseTerm = () => {
    let value = parseUnary();
    while (["*", "/"].includes(tokens[position])) {
      const op = tokens[position++]; const right = parseUnary();
      if (op === "/" && right === 0) throw new Error("Cannot divide by zero");
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };
  const parseUnary = () => {
    if (tokens[position] === "+") { position++; return parseUnary(); }
    if (tokens[position] === "-") { position++; return -parseUnary(); }
    return parsePostfix();
  };
  const parsePostfix = () => {
    let value = parsePrimary();
    while (tokens[position] === "%") { position++; value /= 100; }
    return value;
  };
  const parsePrimary = () => {
    if (tokens[position] === "(") {
      position++; const value = parseExpression();
      if (tokens[position++] !== ")") throw new Error("Missing closing parenthesis");
      return value;
    }
    const token = tokens[position++];
    if (!token || Number.isNaN(Number(token))) throw new Error("Complete the expression");
    return Number(token);
  };
  if (!tokens.length) throw new Error("Enter a calculation");
  const value = parseExpression();
  if (position !== tokens.length || !Number.isFinite(value)) throw new Error("Check the expression");
  return Number.isInteger(value) ? String(value) : value.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
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
    const formatted = Number(raw).toLocaleString("en-US", { maximumFractionDigits: 10, useGrouping: true });
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
