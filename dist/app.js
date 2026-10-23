const tibetanDigits = "༠༡༢༣༤༥༦༧༨༩";
const expressionEl = document.querySelector("#expression");
const resultEl = document.querySelector("#result");
const errorEl = document.querySelector("#error");
const historyPanel = document.querySelector("#historyPanel");
const historyButton = document.querySelector("#historyButton");
const historyList = document.querySelector("#historyList");
let expression = "";
let history = [];

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
    while (["*", "/", "%"].includes(tokens[position])) {
      const op = tokens[position++]; const right = parseUnary();
      if ((op === "/" || op === "%") && right === 0) throw new Error("Cannot divide by zero");
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  };
  const parseUnary = () => {
    if (tokens[position] === "+") { position++; return parseUnary(); }
    if (tokens[position] === "-") { position++; return -parseUnary(); }
    return parsePrimary();
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
    const raw = evaluate(expression);
    const formatted = Number(raw).toLocaleString("en-US", { maximumFractionDigits: 10, useGrouping: true });
    const result = toTibetan(formatted);
    resultEl.textContent = result;
    history.unshift({ expression: pretty(expression), result });
    history = history.slice(0, 8);
    renderHistory();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

function renderHistory() {
  historyList.innerHTML = history.length ? history.map(item => `<li><span>${item.expression}</span><b>${item.result}</b></li>`).join("") : "<li>No calculations yet.</li>";
}

document.querySelector(".keypad").addEventListener("click", event => {
  const key = event.target.closest("button"); if (!key) return;
  if (key.dataset.action === "clear") { expression = ""; resultEl.textContent = "༠"; render(); return; }
  if (key.dataset.action === "backspace") { expression = expression.slice(0, -1); render(); return; }
  if (key.dataset.action === "equals") { calculate(); return; }
  if (expression.length < 64) expression += key.dataset.value; render();
});

document.addEventListener("keydown", event => {
  if (/^[0-9()+\-*/%.]$/.test(event.key)) { expression += event.key; render(); }
  else if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculate(); }
  else if (event.key === "Backspace") { expression = expression.slice(0, -1); render(); }
  else if (event.key === "Escape") { expression = ""; resultEl.textContent = "༠"; render(); }
});

historyButton.addEventListener("click", () => {
  const open = historyPanel.hidden; historyPanel.hidden = !open; historyButton.setAttribute("aria-expanded", String(open));
});
document.querySelector("#clearHistory").addEventListener("click", () => { history = []; renderHistory(); });
document.querySelector("[data-scroll-history]").addEventListener("click", () => document.querySelector("#calculator").scrollIntoView({ behavior: "smooth" }));
render();
