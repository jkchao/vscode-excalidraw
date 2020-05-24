  
// import * as webpack from "webpack";
// import path = require("path");

const path = require('path');

const resolve = file => path.resolve(__dirname, file);

module.exports = {
	target: "node",
	entry: resolve("./src/extension"),
	output: {
		path: resolve("./dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	devtool: "source-map",
	externals: {
		vscode: "commonjs vscode",
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.html$/i,
				loader: "raw-loader",
			},
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	}
};
