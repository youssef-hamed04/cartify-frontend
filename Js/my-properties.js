import { realEstateAPI } from './api.js';
import {
  $,
  requireLogin,
  locations,
  card,
  el,
  link,
  button,
  confirmAction,
  message,
  loginURL,
} from './real-estate-shared.js';
let locationData;
async function updatePropertyStatus(property, actionType, trigger) {
  const status =
    actionType === 'close' ? (property.listingType === 'sale' ? 'sold' : 'rented') : actionType;
  const accepted = await confirmAction(
    status === 'delete' ? 'Delete property?' : `Mark property as ${status}?`,
    status === 'delete'
      ? `Delete “${property.title}”? This cannot be undone.`
      : `Update “${property.title}” to ${status}? It will no longer appear as an available listing.`,
  );
  if (!accepted) {
    return;
  }
  trigger.disabled = true;
  try {
    if (status === 'delete') {
      await realEstateAPI.delete(property._id);
    } else {
      await realEstateAPI.status(property._id, status);
    }
    await loadProperties();
    $('status').textContent = 'Property updated.';
  } catch (error) {
    if (error.status === 401) {
      location.assign(loginURL());
    } else {
      $('status').textContent = message(error);
    }
  } finally {
    trigger.disabled = false;
  }
}
async function loadProperties() {
  $('status').textContent = 'Loading your properties…';
  const result = await realEstateAPI.myProperties();
  const createOwnedPropertyCard = (property) => {
    const article = card(property, locationData);
    const body = article.querySelector('.card-body');
    body.append(el('p', property.status, 're-verdict'));
    if (property.status === 'rejected') {
      body.append(
        el(
          'p',
          'Reason: ' + (property.rejectionReason || property.reason || 'No reason provided.'),
        ),
      );
    }
    const actions = el('div', null, 're-actions');
    actions.append(
      link(
        'View',
        './property.html?id=' + encodeURIComponent(property._id),
        'btn btn-outline-primary',
      ),
      link(
        'Edit',
        './sell-property.html?edit=' + encodeURIComponent(property._id),
        'btn btn-outline-primary',
      ),
    );
    if (property.status === 'approved') {
      actions.append(
        button(property.listingType === 'sale' ? 'Mark sold' : 'Mark rented', (event) =>
          updatePropertyStatus(property, 'close', event.currentTarget),
        ),
      );
    }
    if (property.status !== 'archived') {
      actions.append(
        button('Archive', (event) =>
          updatePropertyStatus(property, 'archived', event.currentTarget),
        ),
      );
    }
    actions.append(
      button('Delete', (event) => updatePropertyStatus(property, 'delete', event.currentTarget)),
    );
    body.append(actions);
    return article;
  };
  $('my-listings').replaceChildren(...result.properties.map(createOwnedPropertyCard));
  $('status').textContent = result.properties.length
    ? `${result.properties.length} properties`
    : 'You have no properties yet. Add your first listing for admin review.';
}
try {
  if (await requireLogin()) {
    locationData = await locations();
    await loadProperties();
  }
} catch (error) {
  $('status').textContent = message(error);
}
