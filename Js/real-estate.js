import { realEstateAPI } from './api.js';
import {
  $,
  locations,
  setupLocations,
  card,
  pagination,
  message,
  validation,
} from './real-estate-shared.js';
const form = $('filters');
const validate = validation(form);
let locationData;
let locationControls;
let requestSequence = 0;
const filterFields = [
  'listingType',
  'city',
  'district',
  'propertyType',
  'minPrice',
  'maxPrice',
  'minArea',
  'maxArea',
  'rooms',
  'finishing',
  'q',
  'sort',
];
function restoreFilters() {
  form.reset();
  const query = new URLSearchParams(location.search);
  for (const key of filterFields.filter((fieldName) => fieldName !== 'district')) {
    if (query.has(key)) {
      form.elements[key].value = query.get(key);
    }
  }
  if (!['sale', 'rent'].includes(form.elements.listingType.value)) {
    form.elements.listingType.value = 'sale';
  }
  locationControls.districts();
  form.elements.district.value = query.get('district') || '';
  locationControls.views();
}
function filterParameters() {
  const queryParameters = new URLSearchParams();
  for (const key of filterFields) {
    if (form.elements[key].value) {
      queryParameters.set(key, form.elements[key].value);
    }
  }
  return queryParameters;
}
function pageURL(page) {
  const queryParameters = filterParameters();
  if (page > 1) {
    queryParameters.set('page', page);
  }
  return './real-estate.html?' + queryParameters;
}
async function loadProperties() {
  // Ignore responses from filters that have since been replaced.
  const request = ++requestSequence;
  const queryParameters = filterParameters();
  queryParameters.set(
    'page',
    Math.max(1, Number(new URLSearchParams(location.search).get('page')) || 1),
  );
  queryParameters.set('limit', 12);
  $('status').textContent = 'Loading properties…';
  $('results').setAttribute('aria-busy', 'true');
  $('results').replaceChildren();
  $('pagination').replaceChildren();
  try {
    const result = await realEstateAPI.properties(queryParameters);
    if (request !== requestSequence) {
      return;
    }
    $('results').replaceChildren(
      ...result.properties.map((property) => card(property, locationData)),
    );
    $('status').textContent = result.total
      ? `${result.total} properties found`
      : 'No properties match these filters. Try another district or a wider price range.';
    pagination($('pagination'), Number(result.page), Number(result.pages), navigateToPage, pageURL);
  } catch (error) {
    if (request === requestSequence) {
      $('status').textContent = message(error);
    }
  } finally {
    if (request === requestSequence) {
      $('results').setAttribute('aria-busy', 'false');
    }
  }
}
function navigateToPage(page = 1) {
  history.pushState(null, '', pageURL(page));
  loadProperties();
}
const applyFilters = (event) => {
  event.preventDefault();
  for (const [minimumField, maximumField] of [
    ['minPrice', 'maxPrice'],
    ['minArea', 'maxArea'],
  ]) {
    const minimumInput = form.elements[minimumField];
    const maximumInput = form.elements[maximumField];
    maximumInput.setCustomValidity(
      minimumInput.value &&
        maximumInput.value &&
        Number(minimumInput.value) > Number(maximumInput.value)
        ? 'Enter a maximum greater than or equal to the minimum.'
        : '',
    );
  }
  if (validate()) {
    navigateToPage();
  }
};
form.addEventListener('submit', applyFilters);
for (const key of ['maxPrice', 'minPrice', 'maxArea', 'minArea']) {
  form.elements[key].addEventListener('input', () => {
    form.elements.maxPrice.setCustomValidity('');
    form.elements.maxArea.setCustomValidity('');
  });
}
form.querySelectorAll('[name="listingType"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    if (validate()) {
      navigateToPage();
    }
  }),
);
const restoreHistoryFilters = () => {
  if (locationData) {
    restoreFilters();
    loadProperties();
  }
};
window.addEventListener('popstate', restoreHistoryFilters);
try {
  locationData = await locations();
  locationControls = setupLocations(form, locationData, true);
  $('data-note').textContent = locationData.dataNote || '';
  restoreFilters();
  await loadProperties();
} catch (error) {
  $('status').textContent = message(error);
  $('results').setAttribute('aria-busy', 'false');
}
