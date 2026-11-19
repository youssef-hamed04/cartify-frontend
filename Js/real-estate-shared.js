import { realEstateAPI, authAPI } from './api.js';
export const $ = (id) => document.getElementById(id);
export const money = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? 'Not available'
    : new Intl.NumberFormat('en-EG', {
        style: 'currency',
        currency: 'EGP',
        maximumFractionDigits: 0,
      }).format(Number(value));
// "super-lux" -> "Super lux", "below_market" -> "Below market"
export const label = (value) => {
  const text = String(value ?? '')
    .replaceAll('-', ' ')
    .replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
export const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) {
    node.textContent = text;
  }
  if (className) {
    node.className = className;
  }
  return node;
};
export const link = (text, href, className) => {
  const node = el('a', text, className);
  node.href = href;
  return node;
};
export function button(text, action, className = 'btn btn-outline-primary') {
  const node = el('button', text, className);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
export function message(error) {
  return error?.status === 429
    ? 'Too many estimates requested. Please wait a minute and try again.'
    : error?.message || 'The service is unavailable. Please try again.';
}
export function loginURL() {
  return (
    './login.html?redirect=' +
    encodeURIComponent(location.pathname.split('/').pop() + location.search)
  );
}
export async function requireLogin() {
  try {
    const data = await authAPI.getMe();
    if (data.user || data.data?.user) {
      return true;
    }
    location.replace(loginURL());
    return false;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      location.replace(loginURL());
    } else {
      throw error;
    }
    return false;
  }
}
export function safeImage(url) {
  try {
    const imageURL = new URL(url, location.href);
    return ['http:', 'https:', 'blob:'].includes(imageURL.protocol) ? imageURL.href : '';
  } catch {
    return '';
  }
}
export function photo(url, alt) {
  const image = el('img');
  image.alt = alt;
  image.loading = 'lazy';
  const imageSource = safeImage(url);
  image.src = imageSource || './img/the main logo 2.png';
  image.addEventListener(
    'error',
    () => {
      image.removeAttribute('src');
      image.alt = 'Photo unavailable: ' + alt;
    },
    {
      once: true,
    },
  );
  return image;
}
// Share the location request across callers, but allow retries after a failure.
let locationsPromise;
export const locations = () =>
  (locationsPromise ||= realEstateAPI.locations().catch((error) => {
    locationsPromise = null;
    throw error;
  }));
export function locationNode(data, city, district) {
  const node = el('span');
  const cityEntry = data?.cities?.find((item) => item.slug === city);
  const districtEntry = cityEntry?.districts?.find((item) => item.slug === district);
  const add = (entry, fallback) => {
    node.append(document.createTextNode(entry?.nameEn || label(fallback)));
    if (entry?.nameAr) {
      node.append(document.createTextNode(' · '));
      const arabicName = el('span', entry.nameAr);
      arabicName.lang = 'ar';
      arabicName.dir = 'rtl';
      node.append(arabicName);
    }
  };
  // Small towns have a single district with the town's own name: show the name once.
  const sameAsCity = districtEntry && cityEntry && districtEntry.nameEn === cityEntry.nameEn;
  if (district && !sameAsCity) {
    add(districtEntry, district);
    node.append(document.createTextNode(', '));
  }
  add(cityEntry, city);
  return node;
}
export function options(select, values, empty = false) {
  const previousValue = select.value;
  select.replaceChildren();
  if (empty) {
    select.append(new Option('Any', ''));
  }
  for (const entry of values || []) {
    select.append(
      new Option(
        typeof entry === 'string'
          ? label(entry)
          : entry.nameEn + (entry.nameAr ? ' · ' + entry.nameAr : ''),
        typeof entry === 'string' ? entry : entry.slug,
      ),
    );
  }
  if ([...select.options].some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}
export function setupLocations(form, data, browse = false) {
  const fields = form.elements;
  options(fields.city, data.cities, browse);
  options(fields.propertyType, data.propertyTypes, browse);
  options(fields.finishing, data.finishing, browse);
  function views() {
    const city = data.cities.find((cityEntry) => cityEntry.slug === fields.city.value);
    const district = city?.districts.find(
      (districtEntry) => districtEntry.slug === fields.district.value,
    );
    if (fields.view) {
      options(fields.view, district?.views || []);
    }
    $('location-label')?.replaceChildren(
      locationNode(data, fields.city.value, fields.district.value),
    );
  }
  function districts() {
    options(
      fields.district,
      data.cities.find((cityEntry) => cityEntry.slug === fields.city.value)?.districts || [],
      browse,
    );
    views();
  }
  fields.city.addEventListener('change', () => {
    fields.district.value = '';
    districts();
  });
  fields.district.addEventListener('change', views);
  districts();
  function furnished() {
    if (!fields.furnished) {
      return;
    }
    const rent = fields.listingType.value === 'rent';
    $('furnished-field').hidden = !rent;
    fields.furnished.disabled = !rent;
    if (!rent) {
      fields.furnished.checked = false;
    }
  }
  form
    .querySelectorAll('[name="listingType"]')
    .forEach((radio) => radio.addEventListener('change', furnished));
  furnished();
  return {
    districts,
    views,
    furnished,
  };
}
const numericFields = ['area', 'rooms', 'bathrooms', 'floor', 'buildingAge'];
export function estimatePayload(form) {
  const data = Object.fromEntries(new FormData(form));
  const result = {};
  for (const key of [
    'listingType',
    'propertyType',
    'city',
    'district',
    'finishing',
    'view',
    ...numericFields,
  ]) {
    result[key] = numericFields.includes(key) ? Number(data[key]) : data[key];
  }
  result.hasElevator = form.elements.hasElevator.checked;
  result.furnished = data.listingType === 'rent' && form.elements.furnished.checked;
  return result;
}
export function validation(form) {
  form.noValidate = true;
  const controls = [...form.querySelectorAll('input, select, textarea')];
  function clear(control) {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
    $(control.id + '-error')?.remove();
  }
  function check(control) {
    clear(control);
    if (control.disabled || control.checkValidity()) {
      return true;
    }
    const error = el(
      'p',
      'Error: ' +
        (control.validity.patternMismatch
          ? 'Enter an 11-digit Egyptian mobile number beginning 010, 011, 012 or 015.'
          : control.validationMessage),
      're-error',
    );
    error.id = control.id + '-error';
    control.after(error);
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', error.id);
    return false;
  }
  controls.forEach((control) => {
    control.addEventListener('blur', () => check(control));
    control.addEventListener('input', () => clear(control));
    control.addEventListener('change', () => clear(control));
  });
  return (subset = controls) => {
    let firstInvalidControl;
    for (const control of subset) {
      if (!check(control)) {
        firstInvalidControl ||= control;
      }
    }
    firstInvalidControl?.focus();
    return !firstInvalidControl;
  };
}
export const verdict = (value) =>
  ({
    below_market: 'Good deal',
    fair: 'Fair price',
    above_market: 'Above market',
  })[value] || 'Estimate unavailable';
export function comparison(price, estimate) {
  if (!(Number(estimate.price) > 0)) {
    return '';
  }
  const differencePercent = ((Number(price) - estimate.price) / estimate.price) * 100;
  return `${Math.abs(differencePercent).toFixed(1)}% ${
    differencePercent < 0 ? 'below' : differencePercent > 0 ? 'above' : 'from'
  } our estimate`;
}
export function renderEstimate(target, estimate, listingType, asking) {
  target.hidden = false;
  target.replaceChildren(el('h2', 'Our price estimate'));
  if (!estimate) {
    target.append(el('p', 'An estimate is not available for this property yet.'));
    return;
  }
  const suffix = listingType === 'rent' ? ' / month' : '';
  target.append(
    el('p', money(estimate.price) + suffix, 're-price'),
    el('p', `Likely range: ${money(estimate.low)} – ${money(estimate.high)}${suffix}`),
    el('p', `${money(estimate.pricePerM2)} / m²${suffix}`),
  );
  if (asking != null) {
    const inferredVerdict =
      asking < estimate.low ? 'below_market' : asking > estimate.high ? 'above_market' : 'fair';
    target.append(
      el('p', `${verdict(estimate.verdict || inferredVerdict)} · ${comparison(asking, estimate)}`),
    );
  }
  target.append(
    el(
      'p',
      estimate.method === 'comparables'
        ? `Based on ${estimate.comparablesCount ?? 'available'} comparable records.`
        : `Machine-learning model: ${estimate.model || 'not specified'}, trained on Dakahlia market records.`,
      'text-muted',
    ),
    el('p', 'This is a market estimate, not a guaranteed sale or rental price.', 'text-muted'),
  );
}
export function card(property, data) {
  const article = el('article', null, 'card re-card');
  article.append(
    photo(property.images?.[0]?.url, `${property.title} in ${label(property.district)}`),
  );
  const body = el('div', null, 'card-body');
  const heading = el('h2');
  heading.append(
    link(property.title, './property.html?id=' + encodeURIComponent(property._id), 'card-link'),
  );
  body.append(
    heading,
    el(
      'p',
      money(property.price) + (property.listingType === 'rent' ? ' / month' : ''),
      're-price',
    ),
    el(
      'p',
      `${money(property.area > 0 ? property.price / property.area : null)} / m²${property.listingType === 'rent' ? ' / month' : ''}`,
    ),
    el('p', `${property.area} m² · ${property.rooms} rooms · ${property.bathrooms} baths`),
    locationNode(data, property.city, property.district),
    el('p', verdict(property.estimate?.verdict), 're-verdict'),
  );
  article.append(body);
  return article;
}
export function pagination(target, page, pages, select, urlFor) {
  target.replaceChildren();
  if (pages <= 1) {
    return;
  }
  const add = (text, pageNumber) => {
    const node = urlFor
      ? link(text, urlFor(pageNumber), 'btn btn-outline-primary')
      : button(text, () => select(pageNumber));
    if (urlFor) {
      node.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        select(pageNumber);
      });
    }
    target.append(node);
  };
  if (page > 1) {
    add('Previous', page - 1);
  }
  target.append(el('span', `Page ${page} of ${pages}`));
  if (page < pages) {
    add('Next', page + 1);
  }
}
let tableId = 0;
export function table(caption, headers, rows) {
  const wrapper = el('div', null, 'table-wrapper');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  const tableElement = el('table', null, 'table');
  const captionElement = el('caption', caption);
  captionElement.id = 're-table-' + ++tableId;
  wrapper.setAttribute('aria-labelledby', captionElement.id);
  tableElement.append(captionElement);
  const head = el('thead');
  const tableRow = el('tr');
  headers.forEach((header) => {
    const headerCell = el('th', header);
    headerCell.scope = 'col';
    tableRow.append(headerCell);
  });
  head.append(tableRow);
  tableElement.append(head);
  const body = el('tbody');
  rows.forEach((row) => {
    const tableRow = el('tr');
    row.forEach((value, index) => {
      const cell = el('td');
      cell.dataset.label = headers[index];
      cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? '—')));
      tableRow.append(cell);
    });
    body.append(tableRow);
  });
  tableElement.append(body);
  wrapper.append(tableElement);
  return wrapper;
}
export function confirmAction(title, description, needsReason = false) {
  const dialog = $('action-dialog');
  $('dialog-title').textContent = title;
  $('dialog-message').textContent = description;
  $('reason-field').hidden = !needsReason;
  $('reason').required = needsReason;
  $('reason').value = '';
  $('reason').setCustomValidity('');
  $('reason').oninput = () =>
    $('reason').setCustomValidity($('reason').value.trim() ? '' : 'Enter a reason.');
  const form = $('dialog-form');
  // Reopening the dialog must not register another submit listener.
  if (!form.dataset.validated) {
    const validate = validation(form);
    form.addEventListener('submit', (event) => {
      if (event.submitter?.value !== 'cancel' && !validate()) {
        event.preventDefault();
      }
    });
    form.dataset.validated = 'true';
  }
  $('reason-error')?.remove();
  $('reason').removeAttribute('aria-invalid');
  $('reason').removeAttribute('aria-describedby');
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener(
      'close',
      () => {
        // Clear the decision so Escape cannot reuse a previous confirmation.
        const accepted = dialog.returnValue === 'confirm';
        dialog.returnValue = '';
        resolve(
          accepted
            ? {
                reason: $('reason').value.trim(),
              }
            : null,
        );
      },
      {
        once: true,
      },
    ),
  );
}
