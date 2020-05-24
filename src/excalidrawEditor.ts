 import * as vscode from 'vscode';
import { join } from 'path';

export class ExcalidrawEditorProvider implements vscode.CustomExecution {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ExcalidrawEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            ExcalidrawEditorProvider.viewType,
            provider
        );
        return providerRegistration;
    }

    private static readonly viewType = 'excalidraw.openEditor';
    private buildPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.buildPath = join(context.extensionPath, 'excalidraw', 'build');
    }

    private readFileOnDisk(path: string) {
        return vscode.Uri.file(join(this.buildPath, path)).with({
            scheme: 'vscode-resource'
        });
    }
    private updateExcalidrawContent(document: vscode.TextDocument, data: string) {
        // https://github.com/excalidraw/excalidraw/blob/c427aa3cce801bef4dd9107e1044d3a4f61a201e/src/data/json.ts#L12
        const elements = JSON.parse(data);

        // TODO AppState, viewBackgroundColor
        const result = JSON.stringify({
            type: 'excalidraw',
            elements: elements.filter((element: any) => !element.isDeleted),
            appState: {
                viewBackgroundColor: '#ffffff'
            }
        });

        const buf = Buffer.from(result);
        vscode.workspace.fs.writeFile(document.uri, buf);
    }

    private createWebViewContent() {
        // script
        const manifest = require(`${this.buildPath}/asset-manifest.json`);
        const mainScript = manifest.files['main.js'];
        const mainStyle = manifest.files['main.css'];
        const runtimeScript = manifest.files['runtime-main.js'];
        // chunk
        const chunkScript = [];
        for (const key in manifest.files) {
            if (key.endsWith('.chunk.js') && manifest.files.hasOwnProperty(key)) {
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
        <!-- TODO font-family -->
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

        <script>
        let initData = {};
  
        window.addEventListener('message', event => {

            const message = event.data; // The JSON data our extension sent

            switch (message.command) {
                case 'loadLocalData':
                    initData = message.data;
                    initLocalStorage();
                    initScript();
                    break;
            }
        });

      // https://github.com/Microsoft/vscode/issues/48464
      Object.defineProperty(document, 'cookie', { value: '' });

      function initLocalStorage() {
          const vscode = acquireVsCodeApi();
      
          const storage = {};
          const log = console.log
          const bridgedLocalStorage = {
            getItem: function (key) {
              log("localStorage: get " + key);
              console.log('====');
              console.log(initData);
              
              let result;

              switch (key) {
                    case 'excalidraw':
                        result = initData.elements;
                        break;
                    case 'excalidraw-state':
                        result = initData.appState;
                        break;
                    default:
                        result = storage[key];
                        break;
              }
              return JSON.stringify(result);
            },
            setItem: function (key, val) {
              log("localStorage: set " + key + " to " + val);

              if (key === 'excalidraw') {
                vscode.postMessage({
                    command: 'update',
                    data: val
                  });
              }
              storage[key] = val;
            },
            removeItem: function (key) {
                log("localStorage: remove " + key);
                delete storage[key];
            },
          };

          Object.defineProperty(window, 'localStorage', {
            value: bridgedLocalStorage,
          });
      }

        function initScript() {
            const fragment = document.createDocumentFragment();
            const runtimeTag = document.createElement('script');
            const mainScriptTag = document.createElement('script');
            const chunkScript = '${chunkScript}';
            runtimeTag.src = '${runtimeScriptOnDisk}';
            mainScriptTag.src = '${mainScriptOnDisk}';

            fragment.appendChild(runtimeTag);
            
            chunkScript.split(',').forEach(item => {
                const tag = document.createElement('script');
                tag.src = item;
                fragment.appendChild(tag);
            });
            fragment.appendChild(mainScriptTag);

            document.body.appendChild(fragment);
        }
  
        </script>

    </head>
    <body>
      <div id="root">
          <div class="LoadingMessage"><span>Loading scene...</span></div>
      </div>
    </body>
    </html>`;
    }

    public async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        webviewPanel.webview.options = {
            enableScripts: true
        };

        const fileContent = await vscode.workspace.fs.readFile(document.uri);

        try {
            let parseContent = JSON.parse(fileContent.toString());
            if (parseContent) {
                // init data to extension
                webviewPanel.webview.postMessage({ command: 'loadLocalData', data: parseContent });
            }
        } catch (error) {
            vscode.window.showErrorMessage(error);
        }

        webviewPanel.webview.html = this.createWebViewContent();

        webviewPanel.onDidDispose(() => {
            // ..
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.command) {
                case 'update':
                    this.updateExcalidrawContent(document, e.data);
                    return;
            }
        });
    }
}
