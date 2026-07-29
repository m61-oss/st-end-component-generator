import assert from 'node:assert/strict';
import { getNotificationMethod } from '../ui/notification-utils.js';

assert.equal(getNotificationMethod('success'), 'success');
assert.equal(getNotificationMethod('warning'), 'warning');
assert.equal(getNotificationMethod('error'), 'error');
assert.equal(getNotificationMethod('info'), 'info');
assert.equal(getNotificationMethod('unexpected'), 'info');
