/* =========================================================
   Платёжная форма (в стиле Steam) + валидация «от дурака»
   ========================================================= */

// ---------- Правила валидации ----------

// ФИО: только буквы (русские/латинские) и дефис. Цифры и спецсимволы запрещены.
const NAME_RE = /^[A-Za-zА-Яа-яЁё]+(?:[- ][A-Za-zА-Яа-яЁё]+)*$/;

// Проверка имени/фамилии/отчества. allowEmpty — для необязательного отчества.
function validateName(value, label, { allowEmpty = false } = {}) {
  const v = value.trim();
  if (!v) return allowEmpty ? '' : `${label}: введите значение`;
  if (/\d/.test(v)) return `${label}: цифры недопустимы — только буквы`;
  if (!NAME_RE.test(v)) return `${label}: допустимы только буквы и дефис (спецсимволы запрещены)`;
  if (v.length < 2) return `${label}: слишком короткое значение`;
  return '';
}

// Email: обязательна собака @ и корректная структура.
function validateEmail(value) {
  const v = value.trim();
  if (!v) return 'Почта: введите адрес';
  if (!v.includes('@')) return 'Почта: отсутствует символ @ (собака)';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
    return 'Почта: некорректный формат (пример: user@example.com)';
  return '';
}

// Номер карты: ровно 16 ЦИФР (пробелы игнорируются).
function validateCardNumber(value) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'Номер карты: введите цифры';
  if (digits.length !== 16)
    return `Номер карты: должно быть ровно 16 цифр (сейчас ${digits.length})`;
  if (value.replace(/[0-9 ]/g, '').length > 0)
    return 'Номер карты: допускаются только цифры';
  return '';
}

// CVV: ровно 3 ЦИФРЫ.
function validateCvv(value) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'CVV: введите код';
  if (value.replace(/[0-9]/g, '').length > 0)
    return 'CVV: допускаются только цифры';
  if (digits.length !== 3)
    return `CVV: должно быть ровно 3 цифры (сейчас ${digits.length})`;
  return '';
}

// Срок действия ММ/ГГ: карта не должна быть просрочена
// (должна заканчиваться НЕ раньше октября 2026 — 10/26).
const MIN_EXP = { month: 10, year: 26 }; // 10/26 включительно считается действующей

function parseExpiry(value) {
  const m = value.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

function validateExpiry(value) {
  const v = value.trim();
  if (!v) return 'Срок действия: введите дату в формате ММ/ГГ';
  const parsed = parseExpiry(v);
  if (!parsed) return 'Срок действия: неверный формат (нужно ММ/ГГ, например 11/27)';
  const { month, year } = parsed;
  // Просрочено, если дата окончания раньше 10/26
  if (year < MIN_EXP.year || (year === MIN_EXP.year && month < MIN_EXP.month))
    return 'Срок действия: карта просрочена (дата должна быть не раньше 10/26)';
  return '';
}

// ---------- Привязка к DOM ----------

const form = document.getElementById('payment-form');

const fields = {
  lastName:    { el: document.getElementById('lastName'),    err: document.getElementById('err-lastName') },
  firstName:   { el: document.getElementById('firstName'),   err: document.getElementById('err-firstName') },
  middleName:  { el: document.getElementById('middleName'),  err: document.getElementById('err-middleName') },
  email:       { el: document.getElementById('email'),       err: document.getElementById('err-email') },
  cardNumber:  { el: document.getElementById('cardNumber'),  err: document.getElementById('err-cardNumber') },
  expiry:      { el: document.getElementById('expiry'),      err: document.getElementById('err-expiry') },
  cvv:         { el: document.getElementById('cvv'),         err: document.getElementById('err-cvv') },
};

function setError(key, message) {
  const f = fields[key];
  f.err.textContent = message;
  f.el.classList.toggle('invalid', !!message);
  f.el.classList.toggle('valid', !message && f.el.value.trim() !== '');
}

// Полная проверка одного поля
function checkField(key) {
  const value = fields[key].el.value;
  let msg = '';
  switch (key) {
    case 'lastName':   msg = validateName(value, 'Фамилия'); break;
    case 'firstName':  msg = validateName(value, 'Имя'); break;
    case 'middleName': msg = validateName(value, 'Отчество', { allowEmpty: true }); break;
    case 'email':      msg = validateEmail(value); break;
    case 'cardNumber': msg = validateCardNumber(value); break;
    case 'expiry':     msg = validateExpiry(value); break;
    case 'cvv':        msg = validateCvv(value); break;
  }
  setError(key, msg);
  return msg === '';
}

// ---------- «Умный» ввод ----------

// Номер карты: только цифры, автоформат группами по 4, максимум 16 цифр
fields.cardNumber.el.addEventListener('input', () => {
  let digits = fields.cardNumber.el.value.replace(/\D/g, '').slice(0, 16);
  fields.cardNumber.el.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  updateCardVisual();
});

// CVV: только цифры, максимум 3
fields.cvv.el.addEventListener('input', () => {
  fields.cvv.el.value = fields.cvv.el.value.replace(/\D/g, '').slice(0, 3);
});

// Срок действия: только цифры, авто-подстановка «/», формат ММ/ГГ
fields.expiry.el.addEventListener('input', () => {
  let d = fields.expiry.el.value.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2);
  fields.expiry.el.value = d;
  updateCardVisual();
});

// ФИО: мгновенная мягкая подсказка при вводе
['lastName', 'firstName', 'middleName'].forEach(key => {
  fields[key].el.addEventListener('input', () => checkField(key));
});

// Живая валидация остальных полей при потере фокуса
Object.keys(fields).forEach(key => {
  fields[key].el.addEventListener('blur', () => checkField(key));
});

// ---------- Отображение на «карте» ----------

const ccNumber = document.getElementById('cc-number');
const ccExpiry = document.getElementById('cc-expiry');
const ccHolder = document.getElementById('cc-holder');
const ccBrand  = document.getElementById('cc-brand');

function detectBrand(digits) {
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'MASTERCARD';
  if (/^220/.test(digits)) return 'MIR';
  if (/^3[47]/.test(digits)) return 'AMEX';
  return 'CARD';
}

function updateCardVisual() {
  const digits = fields.cardNumber.el.value.replace(/\D/g, '');
  const shown = digits.padEnd(16, '•');
  ccNumber.textContent = shown.replace(/(.{4})/g, '$1 ').trim();
  ccExpiry.textContent = fields.expiry.el.value || 'MM/YY';
  const holder =
    `${fields.lastName.el.value} ${fields.firstName.el.value}`.trim();
  ccHolder.textContent = holder.toUpperCase() || 'NAME SURNAME';
  ccBrand.textContent = detectBrand(digits);
}

['lastName', 'firstName'].forEach(key =>
  fields[key].el.addEventListener('input', updateCardVisual));

// ---------- Выбор способа оплаты (декоративно) ----------

document.querySelectorAll('.method').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.method').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ---------- Отправка формы ----------

const resultBox = document.getElementById('result');

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const allValid = Object.keys(fields).map(checkField).every(Boolean);

  if (allValid) {
    const last4 = fields.cardNumber.el.value.replace(/\D/g, '').slice(-4);
    resultBox.hidden = false;
    resultBox.className = 'result success';
    resultBox.textContent =
      `✅ Платёж подтверждён! Сумма 1 499.00 ₽ списана с карты •••• ${last4}. Чек отправлен на ${fields.email.el.value.trim()}.`;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    resultBox.hidden = false;
    resultBox.className = 'result fail';
    resultBox.textContent = '⛔ Исправьте ошибки в форме (подсвечены красным) и попробуйте снова.';
    const firstInvalid = form.querySelector('input.invalid');
    if (firstInvalid) firstInvalid.focus();
  }
});

// Сброс
document.getElementById('btn-reset').addEventListener('click', () => {
  Object.keys(fields).forEach(k => setError(k, ''));
  resultBox.hidden = true;
  updateCardVisual();
});

updateCardVisual();
