'use strict';

// Filesystem lookup for brand and roster imagery. Files are found by name, so
// dropping artwork into site/public/images/ is all it takes — no code change,
// no data edit.

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const EXTENSIONS = ['svg', 'png', 'webp', 'jpg', 'jpeg'];

/**
 * First existing file matching `<dir>/<base>.<ext>`, as a web path.
 * @param {string} dir web-relative directory, e.g. 'images/team'
 * @param {string} base filename without extension, e.g. 'raj-jaggi'
 * @returns {string} web path, or '' when nothing matches
 */
function findAsset(dir, base) {
  for (const ext of EXTENSIONS) {
    const rel = `/${dir}/${base}.${ext}`.replace(/\/+/g, '/');
    if (fs.existsSync(path.join(PUBLIC_DIR, rel))) return rel;
  }
  return '';
}

/** Headshot for a team member, by slug: public/images/team/<slug>.jpg */
function findHeadshot(slug) {
  return findAsset('images/team', slug);
}

/** Photo for a listing, by MLS id: public/images/listings/<mlsId>.jpg */
function findListingPhoto(mlsId) {
  return findAsset('images/listings', mlsId);
}

/** Hero/cover image for a neighborhood: public/images/neighborhoods/<slug>.jpg */
function findNeighborhoodPhoto(slug) {
  return findAsset('images/neighborhoods', slug);
}

module.exports = { findAsset, findHeadshot, findListingPhoto, findNeighborhoodPhoto };
