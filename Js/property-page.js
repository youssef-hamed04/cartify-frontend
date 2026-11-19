import { realEstateAPI } from './api.js';
import {
  $,
  locations,
  locationNode,
  photo,
  el,
  link,
  money,
  label,
  renderEstimate,
  card,
  loginURL,
  message,
} from './real-estate-shared.js';
$('status').textContent = 'Loading property…';
try {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    throw new Error('No property selected. Open a listing from Real Estate.');
  }
  const [{ property: property }, locationData] = await Promise.all([
    realEstateAPI.property(id),
    locations(),
  ]);
  document.title = property.title + ' — Cartify Real Estate';
  $('property-title').textContent = property.title;
  $('property-location').replaceChildren(
    locationNode(locationData, property.city, property.district),
  );
  $('property-price').textContent =
    money(property.price) + (property.listingType === 'rent' ? ' / month' : '');
  $('gallery').replaceChildren(
    ...(property.images || []).map((image, i) =>
      photo(image.url, `${property.title} — photo ${i + 1}`),
    ),
  );
  if (!property.images?.length) {
    $('gallery').append(el('p', 'No photos provided.'));
  }
  const details = [
    ['Listing', label(property.listingType)],
    ['Property type', label(property.propertyType)],
    ['Address', property.address],
    ['Area', `${property.area} m²`],
    ['Rooms', property.rooms],
    ['Bathrooms', property.bathrooms],
    ['Floor', property.floor],
    ['Elevator', property.hasElevator ? 'Yes' : 'No'],
    ['Building age', `${property.buildingAge} years`],
    ['Finishing', label(property.finishing)],
    ['Furnished', property.furnished ? 'Yes' : 'No'],
    ['View', label(property.view)],
    ['Listing status', label(property.status)],
  ];
  $('details').replaceChildren(
    ...details.flatMap(([detailLabel, detailValue]) => [
      el('dt', detailLabel),
      el('dd', detailValue ?? 'Not provided'),
    ]),
  );
  $('amenities').replaceChildren(
    ...(property.amenities || []).map((amenity) => el('li', label(amenity))),
  );
  if (!property.amenities?.length) {
    $('amenities').append(el('li', 'No amenities listed.'));
  }
  $('description').textContent = property.description;
  renderEstimate($('estimate'), property.estimate, property.listingType, property.price);
  $('data-note').textContent = locationData.dataNote || '';
  $('owner').textContent = [property.owner?.firstName, property.owner?.lastName]
    .filter(Boolean)
    .join(' ');
  if (property.contactPhone && !property.contactHidden) {
    $('contact').append(
      link(
        property.contactPhone,
        'tel:' + String(property.contactPhone).replace(/[^+0-9]/g, ''),
        'btn btn-primary',
      ),
    );
  } else if (property.contactHidden) {
    $('contact').append(link("Log in to see the seller's phone", loginURL(), 'btn btn-primary'));
  } else {
    $('contact').append(el('p', 'No contact phone available.'));
  }
  $('property-content').hidden = false;
  $('status').textContent = '';
  try {
    const result = await realEstateAPI.properties({
      city: property.city,
      district: property.district,
      listingType: property.listingType,
      limit: 5,
    });
    const similar = result.properties
      .filter((otherProperty) => otherProperty._id !== property._id)
      .slice(0, 4);
    $('similar').replaceChildren(...similar.map((property) => card(property, locationData)));
    $('similar-status').textContent = similar.length
      ? ''
      : 'No similar properties are available yet.';
  } catch (error) {
    $('similar-status').textContent = message(error);
  }
} catch (error) {
  $('status').textContent = message(error);
}
