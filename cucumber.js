module.exports = {
  default: {
    paths: ['specs/**/*.feature'],
    require: ['specs/**/step_definitions/**/*.steps.ts'],
    requireModule: ['ts-node/register'],
    format: ['progress-bar', 'summary'],
    publishQuiet: true,
  },
};
