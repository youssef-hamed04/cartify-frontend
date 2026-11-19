import { realEstateAPI } from './api.js';
import {
  $,
  requireLogin,
  locations,
  setupLocations,
  validation,
  estimatePayload,
  renderEstimate,
  el,
  photo,
  button,
  label,
  message,
  loginURL,
} from './real-estate-shared.js';
const form = $('listing-form');
const editingId = new URLSearchParams(location.search).get('edit');
let existingImages = [];
let addedImages = [];
let removedImageIds = [];
let validate;
let revision = 0;
// Release temporary image URLs when previews are discarded or the page closes.
function revokePreviewURLs() {
  addedImages.forEach((item) => URL.revokeObjectURL(item.url));
}
window.addEventListener('pagehide', revokePreviewURLs);
function renderPreviews() {
  const target = $('previews');
  target.replaceChildren();
  for (const image of existingImages) {
    const figure = el('figure');
    figure.append(
      photo(image.url, 'Existing property photo'),
      button('Remove photo', () => {
        existingImages = existingImages.filter((imageEntry) => imageEntry !== image);
        removedImageIds.push(image.publicId);
        renderPreviews();
      }),
    );
    target.append(figure);
  }
  for (const item of addedImages) {
    const figure = el('figure');
    figure.append(
      photo(item.url, item.file.name),
      button('Remove ' + item.file.name, () => {
        URL.revokeObjectURL(item.url);
        addedImages = addedImages.filter((imageEntry) => imageEntry !== item);
        renderPreviews();
      }),
    );
    target.append(figure);
  }
  $('photo-status').textContent =
    `${existingImages.length + addedImages.length} of 8 photos selected.`;
}
const addSelectedPhotos = () => {
  const files = [...$('images').files];
  const invalid = files.find(
    (file) => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024,
  );
  if (invalid || existingImages.length + addedImages.length + files.length > 8) {
    $('photo-status').textContent =
      'Error: Choose at most 8 image files, each no larger than 5 MB. This selection was not added.';
    $('images').value = '';
    $('images').setAttribute('aria-invalid', 'true');
    $('images').setAttribute('aria-describedby', 'photo-status');
    $('images').focus();
    return;
  }
  $('images').removeAttribute('aria-invalid');
  $('images').removeAttribute('aria-describedby');
  addedImages.push(
    ...files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    })),
  );
  $('images').value = '';
  renderPreviews();
};
$('images').addEventListener('change', addSelectedPhotos);
const invalidateEstimate = () => {
  revision++;
  $('estimate').hidden = true;
};
form.addEventListener('input', invalidateEstimate);
const checkMarketPrice = async () => {
  const subset = [...form.querySelectorAll('input,select')].filter((control) =>
    [
      'listingType',
      'propertyType',
      'city',
      'district',
      'area',
      'rooms',
      'bathrooms',
      'floor',
      'hasElevator',
      'buildingAge',
      'finishing',
      'furnished',
      'view',
      'price',
    ].includes(control.name),
  );
  if (!validate(subset)) {
    return;
  }
  // Do not display an estimate if the form changes while the request is running.
  const requestRevision = revision;
  $('check-price').disabled = true;
  $('status').textContent = 'Checking market price…';
  try {
    const payload = estimatePayload(form);
    const { estimate } = await realEstateAPI.estimate(payload);
    if (requestRevision === revision) {
      renderEstimate(
        $('estimate'),
        estimate,
        payload.listingType,
        Number(form.elements.price.value),
      );
      $('status').textContent = 'Estimate ready.';
    } else {
      $('status').textContent = 'Inputs changed. Check the market price again.';
    }
  } catch (error) {
    $('status').textContent = message(error);
  } finally {
    $('check-price').disabled = false;
  }
};
$('check-price').addEventListener('click', checkMarketPrice);
const submitProperty = async (event) => {
  event.preventDefault();
  if (!validate()) {
    return;
  }
  const body = new FormData(form);
  body.delete('images');
  body.set('hasElevator', String(form.elements.hasElevator.checked));
  body.set(
    'furnished',
    String(form.elements.listingType.value === 'rent' && form.elements.furnished.checked),
  );
  const amenities = [...form.querySelectorAll('[name="amenities"]:checked')].map(
    (control) => control.value,
  );
  body.set('amenities', JSON.stringify(amenities));
  addedImages.forEach((item) => body.append('images', item.file));
  if (editingId) {
    body.set('removeImages', JSON.stringify(removedImageIds));
  }
  $('submit-property').disabled = true;
  $('status').textContent = 'Submitting property…';
  try {
    if (editingId) {
      await realEstateAPI.update(editingId, body);
    } else {
      await realEstateAPI.create(body);
    }
    $('status').textContent = 'Submitted — it will appear after admin review';
    form.hidden = true;
    $('estimate').hidden = true;
    $('my-link').hidden = false;
    revokePreviewURLs();
    addedImages = [];
  } catch (error) {
    if (error.status === 401) {
      location.assign(loginURL());
    } else {
      $('status').textContent = message(error);
    }
  } finally {
    $('submit-property').disabled = false;
  }
};
form.addEventListener('submit', submitProperty);
try {
  if (await requireLogin()) {
    const locationData = await locations();
    const locationControls = setupLocations(form, locationData);
    for (const amenity of locationData.amenities) {
      const wrapper = el('div', null, 're-field re-check');
      const input = el('input');
      input.id = 'amenity-' + amenity;
      input.type = 'checkbox';
      input.name = 'amenities';
      input.value = amenity;
      const amenityLabel = el('label', label(amenity));
      amenityLabel.htmlFor = input.id;
      wrapper.append(amenityLabel, input);
      $('amenity-fields').append(wrapper);
    }
    if (editingId) {
      $('page-title').textContent = 'Edit your property';
      // The owner collection provides pending/rejected listings even if public detail is restricted.
      const ownedProperties = await realEstateAPI.myProperties();
      const property = ownedProperties.properties.find(
        (property) => String(property._id) === editingId,
      );
      if (!property) {
        throw new Error('This property was not found in your listings.');
      }
      for (const key of [
        'listingType',
        'city',
        'propertyType',
        'area',
        'rooms',
        'bathrooms',
        'floor',
        'buildingAge',
        'finishing',
        'title',
        'address',
        'price',
        'contactPhone',
        'description',
      ]) {
        if (property[key] != null) {
          form.elements[key].value = property[key];
        }
      }
      locationControls.districts();
      form.elements.district.value = property.district;
      locationControls.views();
      form.elements.view.value = property.view;
      form.elements.hasElevator.checked = !!property.hasElevator;
      form.elements.furnished.checked = !!property.furnished;
      locationControls.furnished();
      form
        .querySelectorAll('[name="amenities"]')
        .forEach((control) => (control.checked = property.amenities?.includes(control.value)));
      existingImages = [...(property.images || [])];
    }
    validate = validation(form);
    renderPreviews();
    form.hidden = false;
  }
} catch (error) {
  $('status').textContent = message(error);
}
