const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({ env: 'cloudbase-7gd5buxj2de5a644' });

async function getLogs() {
  // Not easily possible via node-sdk without secretId/key.
  // We saw the "missing secretId" error earlier.
}
getLogs();