export default {
  presets: [
    [
      '@babel/preset-env',
      {
        exclude: ['transform-async-to-generator', 'transform-regenerator'],
      },
    ],
  ],
};
