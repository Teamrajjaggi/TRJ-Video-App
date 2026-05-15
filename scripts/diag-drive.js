// One-off Drive diagnostic. Run: node scripts/diag-drive.js
require('dotenv').config();
const fs = require('fs');
const { getDriveClient } = require('../lib/drive-source');

const FOLDERS = {
  PENDING: process.env.DRIVE_PENDING_FOLDER_ID,
  APPROVED: process.env.DRIVE_APPROVED_FOLDER_ID,
  TRASH: process.env.DRIVE_TRASH_FOLDER_ID,
  POSTED: process.env.DRIVE_POSTED_FOLDER_ID,
};

(async () => {
  const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  console.log('Service account email:', sa.client_email);
  console.log('(this exact address must be shared on the folders)\n');

  const client = getDriveClient();
  if (!client) { console.log('ERROR: Drive client failed to init'); return; }

  for (const [label, id] of Object.entries(FOLDERS)) {
    console.log(`--- ${label}  (${id}) ---`);
    if (!id) { console.log('  (no id set)\n'); continue; }
    try {
      const meta = await client.drive.files.get({
        fileId: id,
        fields: 'id,name,mimeType,trashed,owners(emailAddress)',
        supportsAllDrives: true,
      });
      console.log(`  name="${meta.data.name}"  type=${meta.data.mimeType}  trashed=${meta.data.trashed}`);
      const owners = (meta.data.owners || []).map((o) => o.emailAddress).join(', ');
      if (owners) console.log(`  owner: ${owners}`);
    } catch (e) {
      console.log(`  GET FAILED: ${e.message}`);
      console.log('  -> the service account cannot see this folder id at all');
      console.log('');
      continue;
    }
    try {
      const res = await client.drive.files.list({
        q: `'${id}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,size)',
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const files = res.data.files || [];
      console.log(`  contents: ${files.length} item(s)`);
      for (const f of files) console.log(`    - ${f.name}  [${f.mimeType}]  ${f.size || ''}`);
    } catch (e) {
      console.log(`  LIST FAILED: ${e.message}`);
    }
    console.log('');
  }
})().catch((e) => console.error('FATAL:', e.message));
