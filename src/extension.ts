// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ExcalidrawEditorProvider } from './excalidrawEditor';
import { WebViewContent } from './webviewContent';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-excalidraw" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('excalidraw.openWebView', () => {

      // Create and show panel
		const panel = vscode.window.createWebviewPanel(
			'excalidraw',
			'excalidraw',
			vscode.ViewColumn.One,
			{
        enableScripts: true
      }
    );
    
      const rootPath = context.extensionPath;

      panel.webview.html = new WebViewContent(`${rootPath}/excalidraw`).createWebViewContent();
        // return webView.();
  });


//   const provider = vscode.window.registerCustomEditorProvider(
// 	  'excalidraw.openWebView',
// 	  ExcalidrawEditorProvider.register(context)
//   )

	context.subscriptions.push(ExcalidrawEditorProvider.register(context));
//   context.subscriptions.push(disposable);
}