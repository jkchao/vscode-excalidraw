import * as vscode from 'vscode';
import { join } from 'path';

export class WebViewContent {
  private buildPath: string;
  constructor(rootPath: string) {
    this.buildPath = join(rootPath, 'build');
  }

  private readFileOnDisk(path: string) {
    return vscode.Uri.file(join(this.buildPath, path)).with({
      scheme: 'vscode-resource'
    });
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

        <link rel="stylesheet" type="text/css" href="${styleScriptOnDisk}">
        <link rel="stylesheet" href="fonts.css" />
        <link rel="preload" href="${this.buildPath}/FG_Virgil.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        <link rel="preload" href="${this.buildPath}/Cascadia.woff2" as="font" type="font/woff2" crossorigin="anonymous" />

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
        Object.defineProperty(document, 'localStorage', {
          get: () => '',
          set: () => ''
        });
      </script>
      <script src="${runtimeScriptOnDisk}"></script>
      ${chunkScript.map((item: vscode.Uri) => `<script src="${item}"></script>`)}
      <script src="${mainScriptOnDisk}"></script>
      <script>
        window.error = e => {
          console.log(e);
        }
      </script>
    </body>
    </html>`;
  }
}
