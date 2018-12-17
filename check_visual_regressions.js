const BlinkDiff = require('blink-diff');
const path = require('path');

const screenshots = [
  'Stacked Area Graph Test -- Shows loading screen.png',
  'Stacked Area Graph Test -- Shows data.png',
  'Stacked Area Graph Test -- Shows error.png'
];

const baseDir = "screenshots_base";
const dirToCheck = "cypress/screenshots/index_spec.js";
const diffOutputDir = "screenshots_diff";

screenshots.forEach((screenshot) => {
  const imageA = path.resolve(baseDir, screenshot);
  const imageB = path.resolve(dirToCheck, screenshot);
  const output = path.resolve(diffOutputDir, screenshot);
  const diff = new BlinkDiff({
    imageAPath: imageA,
    imageBPath: imageB,
    imageOutputPath: output,
    thresholdType: BlinkDiff.THRESHOLD_PERCENT,
    // 1% threshold
    threshold: 0.01,
  });
  // Run diff
  diff.run((error, result) => {
    // Throw error on fail
    if (error) {
      throw error;
    } else {
      const resultString = diff.hasPassed(result.code) ? 'Passed' : 'Failed';
      console.log(`${screenshot}  - ${resultString}`);
      console.log(`Found ${result.differences} differences.`);
    }
  });
});
