import * as vscode from 'vscode';
import { join } from 'path';

export class ExcalidrawEditorProvider implements vscode.CustomExecution {

	public static register(context: vscode.ExtensionContext): vscode.Disposable { 
		const provider = new ExcalidrawEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(ExcalidrawEditorProvider.viewType, provider);
		return providerRegistration;
	}

  private static readonly viewType = 'excalidraw.openEditor';
  private buildPath: string;
  constructor(
    private context: vscode.ExtensionContext
  ) {
    this.buildPath = join(context.extensionPath, 'excalidraw', 'build');
  }

  private readFileOnDisk(path: string) {
    return vscode.Uri.file(join(this.buildPath, path)).with({
      scheme: 'vscode-resource'
    });
  }

  public resolveCustomTextEditor (
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
  ) {
		webviewPanel.webview.options = {
			enableScripts: true,
		};
    webviewPanel.webview.html = this.createWebViewContent();


		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
			});
		}

    updateWebview();
  }

  public createWebViewContent() {
    // script
    const manifest = require(`${this.buildPath}/asset-manifest.json`);
    console.log(manifest);
    const mainScript = manifest.files['main.js'];
    const mainStyle = manifest.files['main.css'];
    const runtimeScript = manifest.files['runtime-main.js'];
    // chunk
    const chunkScript = [];
    for (const key in manifest.files) {
      if (key.endsWith('.chunk.js') && manifest.files.hasOwnProperty(key)) {
        // finding their paths on the disk
        const chunk = this.readFileOnDisk(manifest.files[key]);
        chunkScript.push(chunk);
      }
    }

    const runtimeScriptOnDisk = this.readFileOnDisk(runtimeScript);
    const mainScriptOnDisk = this.readFileOnDisk(mainScript);
    const styleScriptOnDisk = this.readFileOnDisk(mainStyle);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ExcaliDraw</title>
        
        <link rel="stylesheet" href="${this.context.extensionPath}/fonts.css" />

        <style>
          /* http://www.eaglefonts.com/fg-virgil-ttf-131249.htm */
          @font-face {
            font-family: "Virgil";
            src: url("${this.buildPath}/FG_Virgil.woff2");
            font-display: swap;
          }
          
          /* https://github.com/microsoft/cascadia-code */
          @font-face {
            font-family: "Cascadia";
            src: url("${this.buildPath}/Cascadia.woff2");
            font-display: swap;
          }
        
        </style>

        // <link href="${this.buildPath}/FG_Virgil.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        // <link href="${this.buildPath}/Cascadia.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        
        <link rel="stylesheet" type="text/css" href="${styleScriptOnDisk}">
        <style>
        
        .LoadingMessage {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none
      }

      .LoadingMessage span {
          background-color: rgba(255, 255, 255, .8);
          border-radius: 5px;
          padding: .8em 1.2em;
          font-size: 1.3em
      }

      .visually-hidden {
          position: absolute !important;
          height: 1px;
          width: 1px;
          overflow: hidden;
          clip: rect(1px 1px 1px 1px);
          clip: rect(1px, 1px, 1px, 1px);
          white-space: nowrap
      }
        </style>
        
    </head>
    <body>
      <div id="root">
          <div class="LoadingMessage"><span>Loading scene...</span></div>
      </div>
      <script>
        // https://github.com/Microsoft/vscode/issues/48464
        Object.defineProperty(document, 'cookie', {
          get: () => '',
          set: () => ''
        });
        Object.defineProperty(window, 'localStorage', {
          get: () => '',
          set: (value) => {
            conosle.log(value)
          }
        });
      </script>
      <script src="${runtimeScriptOnDisk}"></script>
      ${chunkScript.map((item: vscode.Uri) => `<script src="${item}"></script>`)}
      <script src="${mainScriptOnDisk}"></script>
    </body>
    </html>`;
  }
}
