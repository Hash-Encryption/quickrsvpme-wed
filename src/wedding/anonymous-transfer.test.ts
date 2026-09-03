import assert from 'node:assert/strict';
import test from 'node:test';

import { hasDraftTransferMarker, readTransferredDraftResult, transferredDraftResult, withDraftTransferMarker } from './anonymous-transfer.ts';

test('anonymous transfer marker and result are stable for retry-safe Draft lookup', () => {
  const configuration = withDraftTransferMarker({ templateId: 'garden-glow' }, 'local-123');
  assert.equal(hasDraftTransferMarker(configuration, 'local-123'), true);
  assert.equal(hasDraftTransferMarker(configuration, 'other'), false);
  assert.deepEqual(readTransferredDraftResult(transferredDraftResult('party', 'draft-1')), { product: 'party', draftId: 'draft-1' });
  assert.equal(readTransferredDraftResult('invalid'), null);
});
