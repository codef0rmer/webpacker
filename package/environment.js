/* eslint global-require: 0 */
/* eslint import/no-dynamic-require: 0 */

const { basename, dirname, join, relative, resolve } = require('path')
const { sync } = require('glob')
const extname = require('path-complete-extname')

const webpack = require('webpack')
const merge = require('webpack-merge')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const ManifestPlugin = require('webpack-manifest-plugin')

const paths = require('./config')
const assetHost = require('./asset_host')

const getBaseLoaders = () => {
  const result = []
  const loaderPaths = sync(resolve(__dirname, 'loaders', '*.js'))
  loaderPaths.forEach(path => result.push(require(path)))
  return result
}

const getBasePlugins = () => {
  const result = []
  result.push(new webpack.EnvironmentPlugin(JSON.parse(JSON.stringify(process.env))))
  result.push(new ExtractTextPlugin('[name]-[contenthash].css'))
  result.push(new ManifestPlugin({ publicPath: assetHost.publicPath, writeToFileEmit: true }))
  return result
}

const getBaseResolvedModules = () => {
  const result = []
  result.push(resolve(paths.source_path))
  result.push('node_modules')
  if (paths.resolved_paths) {
    paths.resolved_paths.forEach(path => result.push(path))
  }
  return result
}

const getExtensionsGlob = () => {
  const { extensions } = paths
  if (!extensions.length) {
    throw new Error('You must configure at least one extension to compile in webpacker.yml')
  }
  return extensions.length === 1 ? `**/${extensions[0]}` : `**/*{${extensions.join(',')}}`
}

const getEntryObject = () => {
  const result = {}
  const glob = getExtensionsGlob()
  const entryPath = join(paths.source_path, paths.source_entry_path)
  const entryPaths = sync(join(entryPath, glob))
  entryPaths.forEach((path) => {
    const namespace = relative(join(entryPath), dirname(path))
    const name = join(namespace, basename(path, extname(path)))
    result[name] = resolve(path)
  })
  return result
}

module.exports = class Environment {
  constructor() {
    this.mergeOptions = {
      entry: 'append',
      'module.rules': 'append',
      plugins: 'append'
    }

    this.config = {
      entry: getEntryObject(),

      output: {
        filename: '[name]-[chunkhash].js',
        chunkFilename: '[name]-[chunkhash].chunk.js',
        path: assetHost.path,
        publicPath: assetHost.publicPath
      },

      module: {
        rules: getBaseLoaders()
      },

      plugins: getBasePlugins(),

      resolve: {
        extensions: paths.extensions,
        modules: getBaseResolvedModules()
      },

      resolveLoader: {
        modules: ['node_modules']
      }
    }
  }

  addLoader(loader) {
    this.config = this.mergeConfig({
      module: {
        rules: Array.isArray(loader) ? loader : [loader]
      }
    })
  }

  addPlugin(plugin) {
    this.config = this.mergeConfig({
      plugins: Array.isArray(plugin) ? plugin : [plugin]
    })
  }

  mergeConfig(config) {
    this.config = merge.smartStrategy(this.mergeOptions)(this.config, config)
    return this.config
  }

  toWebpackConfig() {
    return this.config
  }
}
