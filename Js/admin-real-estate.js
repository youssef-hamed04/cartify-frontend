import { realEstateAdminAPI } from './admin-api.js';
import { requireAdmin, injectSidebar, toast, fmtDate } from './admin-core.js';
import {
  $,
  locations,
  locationNode,
  el,
  link,
  photo,
  button,
  table,
  money,
  label,
  verdict,
  pagination,
  confirmAction,
  message,
} from './real-estate-shared.js';
let locationData;
let status = 'pending';
let page = 1;
let sequence = 0;

// The API may return count maps or aggregate rows.

function normalizeCounts(value) {
  if (!Array.isArray(value)) {
    return value || {};
  }
  return Object.fromEntries(
    value.map((row) => [
      row._id ?? row.status ?? row.listingType ?? row.city,
      row.count ?? row.total ?? 0,
    ]),
  );
}
function notify(text, type = 'success') {
  $('status').textContent = text;
  toast(text, type);
}
async function loadStats() {
  const result = await realEstateAdminAPI.stats();
  const byStatus = normalizeCounts(result.byStatus);
  const byType = normalizeCounts(result.byListingType);
  const byCity = normalizeCounts(result.byCity);
  const total = Object.values(byStatus).reduce((sum, count) => sum + Number(count), 0);
  for (const [key, title] of [
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['closed', 'Sold / Rented'],
    ['all', 'All'],
  ]) {
    $('count-' + key).textContent =
      `${title} (${
        key === 'all'
          ? total
          : key === 'closed'
            ? Number(byStatus.sold || 0) + Number(byStatus.rented || 0)
            : byStatus[key] || 0
      })`;
  }
  $('stats').replaceChildren(
    ...Object.entries({
      ...byStatus,
      ...byType,
    }).map(([key, count]) => {
      const card = el('article', null, 'card re-panel');
      const titles = { sale: 'For sale', rent: 'For rent' };
      card.append(el('h2', titles[key] || label(key)), el('p', String(count), 're-price'));
      return card;
    }),
  );
  const tables = [
    table(
      'Listings by city',
      ['City', 'Listings'],
      Object.entries(byCity).map(([city, count]) => [locationNode(locationData, city), count]),
    ),
  ];
  for (const listingType of ['sale', 'rent']) {
    tables.push(
      table(
        `Average ${listingType === 'sale' ? 'sale price' : 'monthly rent'} per m² by city`,
        ['City', 'Average / m²'],
        (result.avgPerM2ByCity?.[listingType] || []).map((row) => [
          locationNode(locationData, row.city),
          money(row.avgPerM2),
        ]),
      ),
    );
  }
  $('city-stats').replaceChildren(...tables);
}
function renderModel(modelData) {
  const target = $('model');
  target.replaceChildren();
  if (!modelData || modelData.trained === false) {
    target.append(el('p', 'The price models have not been trained yet.'));
    return;
  }
  for (const listingType of ['sale', 'rent']) {
    const item = modelData[listingType];
    const section = el('section');
    section.append(el('h3', listingType === 'sale' ? 'Sale' : 'Rent'));
    if (!item) {
      section.append(el('p', 'No model available.'));
      target.append(section);
      continue;
    }
    section.append(
      el(
        'p',
        `Chosen model: ${item.chosen || 'Not selected'} · ${item.rows ?? 0} training records · Trained: ${fmtDate(item.trainedAt)}`,
      ),
      table(
        `${listingType === 'sale' ? 'Sale' : 'Rent'} model candidates`,
        ['Model', 'MAE (EGP / m²)', 'MAPE (avg. error)', 'R²'],
        (item.candidates || []).map((candidate) => [
          candidate.name,
          money(candidate.mae),
          candidate.mape != null ? `${(candidate.mape * 100).toFixed(1)}%` : '—',
          candidate.r2 != null ? Number(candidate.r2).toFixed(2) : '—',
        ]),
      ),
    );
    target.append(section);
  }
}
async function reviewProperty(property, action, trigger) {
  let reason = '';
  if (action !== 'approve') {
    const answer = await confirmAction(
      action === 'delete' ? 'Delete property?' : 'Reject property?',
      action === 'delete'
        ? `Permanently delete “${property.title}”?`
        : `Explain why “${property.title}” cannot be approved.`,
      action === 'reject',
    );
    if (!answer) {
      return;
    }
    reason = answer.reason;
  }
  trigger.disabled = true;
  try {
    if (action === 'delete') {
      await realEstateAdminAPI.delete(property._id);
    } else {
      await realEstateAdminAPI.review(property._id, action, reason);
    }
    await loadListings();
    await loadStats();
    notify(
      action === 'delete'
        ? 'Property deleted.'
        : action === 'approve'
          ? 'Property approved.'
          : 'Property rejected.',
    );
  } catch (error) {
    notify(message(error), 'error');
  } finally {
    trigger.disabled = false;
  }
}
// Fetch both statuses separately because the API accepts one status per request.
async function loadClosedProperties(requestedPage) {
  const closedListings = [];
  for (const listingStatus of ['sold', 'rented']) {
    let statusPage = 1;
    let pages = 1;
    do {
      const result = await realEstateAdminAPI.properties({
        status: listingStatus,
        page: statusPage,
      });
      closedListings.push(...result.properties);
      pages = Number(result.pages) || 1;
      statusPage++;
    } while (statusPage <= pages);
  }
  closedListings.sort(
    (firstProperty, secondProperty) =>
      new Date(secondProperty.createdAt) - new Date(firstProperty.createdAt),
  );
  const pages = Math.ceil(closedListings.length / 20);
  const currentPage = Math.min(requestedPage, Math.max(1, pages));
  return {
    properties: closedListings.slice((currentPage - 1) * 20, currentPage * 20),
    total: closedListings.length,
    page: currentPage,
    pages,
  };
}
async function loadListings() {
  // Only the latest filter request may update the listing table.
  const requestSequence = ++sequence;
  $('status').textContent = 'Loading listings…';
  $('listings').setAttribute('aria-busy', 'true');
  $('listings').replaceChildren();
  $('pagination').replaceChildren();
  try {
    const result =
      status === 'closed'
        ? await loadClosedProperties(page)
        : await realEstateAdminAPI.properties({
            status,
            page,
          });
    if (requestSequence !== sequence) {
      return;
    }
    page = Number(result.page);
    if (!result.properties.length && page > 1) {
      page--;
      return loadListings();
    }
    const createListingRow = (property) => {
      const title = el('div');
      title.append(el('strong', property.title), el('p', property.status));
      const owner = el('div');
      owner.append(
        el('p', [property.owner?.firstName, property.owner?.lastName].filter(Boolean).join(' ')),
        el('p', property.owner?.email),
      );
      const actions = el('div', null, 're-actions');
      const view = link(
        'View',
        './property.html?id=' + encodeURIComponent(property._id),
        'btn-action',
      );
      view.target = '_blank';
      view.rel = 'noopener';
      actions.append(view);
      if (['pending', 'rejected'].includes(property.status)) {
        actions.append(
          button(
            'Approve',
            (event) => reviewProperty(property, 'approve', event.currentTarget),
            'btn-action',
          ),
        );
      }
      if (['pending', 'approved'].includes(property.status)) {
        actions.append(
          button(
            'Reject',
            (event) => reviewProperty(property, 'reject', event.currentTarget),
            'btn-action',
          ),
        );
      }
      actions.append(
        button(
          'Delete',
          (event) => reviewProperty(property, 'delete', event.currentTarget),
          'btn-action',
        ),
      );
      return [
        photo(property.images?.[0]?.url, property.title),
        title,
        owner,
        `${property.listingType} · ${property.propertyType}`,
        locationNode(locationData, property.city, property.district),
        money(property.price) + (property.listingType === 'rent' ? ' / month' : ''),
        verdict(property.estimate?.verdict),
        fmtDate(property.createdAt),
        actions,
      ];
    };
    const rows = result.properties.map(createListingRow);
    $('listings').replaceChildren(
      table(
        'Property review queue',
        [
          'Photo',
          'Listing',
          'Owner',
          'Type',
          'Location',
          'Price',
          'Estimate verdict',
          'Created',
          'Actions',
        ],
        rows,
      ),
    );
    pagination($('pagination'), Number(result.page), Number(result.pages), (selectedPage) => {
      page = selectedPage;
      loadListings();
    });
    $('status').textContent = result.total
      ? `${result.total} listings`
      : 'No listings with this status.';
  } catch (error) {
    if (requestSequence === sequence) {
      notify(message(error), 'error');
    }
  } finally {
    if (requestSequence === sequence) {
      $('listings').setAttribute('aria-busy', 'false');
    }
  }
}
const handleStatusChange = (event) => {
  status = event.target.value;
  page = 1;
  loadListings();
};
$('status-tabs').addEventListener('change', handleStatusChange);
const retrainModel = async () => {
  const retrainButton = $('retrain');
  retrainButton.disabled = true;
  const spinner = el('span', null, 're-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  retrainButton.replaceChildren(spinner, document.createTextNode(' Training…'));
  $('model-status').textContent = 'Training price models…';
  try {
    const result = await realEstateAdminAPI.train();
    renderModel(result.model);
    $('model-status').textContent = 'Price models trained.';
    notify('Price models trained.');
    await loadStats();
  } catch (error) {
    $('model-status').textContent = message(error);
    toast(message(error), 'error');
  } finally {
    retrainButton.disabled = false;
    retrainButton.textContent = 'Retrain model';
  }
};
$('retrain').addEventListener('click', retrainModel);
const user = await requireAdmin();
if (user) {
  injectSidebar(user);
  try {
    locationData = await locations();
    await Promise.all([
      loadListings(),
      loadStats().catch((error) => notify('Statistics: ' + message(error), 'error')),
      realEstateAdminAPI
        .model()
        .then((result) => renderModel(result.model))
        .catch((error) => {
          $('model-status').textContent = message(error);
        }),
    ]);
  } catch (error) {
    notify(message(error), 'error');
  }
}
