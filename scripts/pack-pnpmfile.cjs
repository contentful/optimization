module.exports = {
  hooks: {
    beforePacking(pkg) {
      delete pkg.devDependencies
      delete pkg.scripts
      return pkg
    },
  },
}
