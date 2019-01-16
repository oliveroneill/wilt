import { addMatchImageSnapshotCommand } from 'cypress-image-snapshot/command';

addMatchImageSnapshotCommand({
  failureThreshold: 0.0005,
  failureThresholdType: 'percent',
});
