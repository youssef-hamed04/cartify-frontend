import { realEstateAPI } from './api.js';
import {
  $,
  locations,
  setupLocations,
  validation,
  estimatePayload,
  renderEstimate,
  table,
  locationNode,
  money,
  message,
} from './real-estate-shared.js';
const form = $('estimator');
const validate = validation(form);
let locationData;
let marketSequence = 0;
let estimateSequence = 0;
async function loadMarket() {
  // A slower previous city request must not replace the current market table.
  const requestSequence = ++marketSequence;
  $('market-status').textContent = 'Loading local market…';
  $('market').replaceChildren();
  try {
    const result = await realEstateAPI.market(form.elements.listingType.value);
    if (requestSequence !== marketSequence) {
      return;
    }
    const rows = result.districts.filter((district) => district.city === form.elements.city.value);
    const suffix = form.elements.listingType.value === 'rent' ? ' / month' : '';
    $('market').replaceChildren(
      table(
        'Average price per m² by district' + suffix,
        ['District', 'Average / m²', 'Median / m²', 'Records'],
        rows.map((district) => [
          locationNode(locationData, district.city, district.district),
          money(district.avgPerM2),
          money(district.medianPerM2),
          district.count,
        ]),
      ),
    );
    $('market-status').textContent = rows.length ? '' : 'No market records for this city yet.';
    $('data-note').textContent = result.dataNote || locationData.dataNote || '';
  } catch (error) {
    if (requestSequence === marketSequence) {
      $('market-status').textContent = message(error);
    }
  }
}
const invalidateEstimate = () => {
  estimateSequence++;
  $('estimate').hidden = true;
};
form.addEventListener('input', invalidateEstimate);
const submitEstimate = async (event) => {
  event.preventDefault();
  if (!validate()) {
    return;
  }
  const requestSequence = ++estimateSequence;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  $('status').textContent = 'Estimating price…';
  try {
    const payload = estimatePayload(form);
    const { estimate } = await realEstateAPI.estimate(payload);
    if (requestSequence === estimateSequence) {
      renderEstimate($('estimate'), estimate, payload.listingType);
      $('status').textContent = 'Estimate ready.';
    } else {
      $('status').textContent = 'Inputs changed. Estimate again for the updated property.';
    }
  } catch (error) {
    $('status').textContent = message(error);
  } finally {
    submitButton.disabled = false;
  }
};
form.addEventListener('submit', submitEstimate);
try {
  locationData = await locations();
  setupLocations(form, locationData);
  form.elements.city.addEventListener('change', loadMarket);
  form
    .querySelectorAll('[name="listingType"]')
    .forEach((radio) => radio.addEventListener('change', loadMarket));
  await loadMarket();
} catch (error) {
  $('status').textContent = message(error);
}
