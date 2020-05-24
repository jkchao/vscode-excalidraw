import * as vscode from 'vscode';
import { join } from 'path';
import html from './webviewHtml.html';

// https://github.com/webpack/webpack/issues/4175
declare const __non_webpack_require__: any;

export class ExcalidrawEditorProvider implements vscode.CustomExecution {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ExcalidrawEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            ExcalidrawEditorProvider.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
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

    private createWebViewContent(webview: vscode.Webview) {
        // script
        // https://github.com/webpack/webpack/issues/4175
        const manifest = __non_webpack_require__(join(this.buildPath, 'asset-manifest.json'));
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
        const virgilFontOnDisk = this.readFileOnDisk('FG_Virgil.woff2');
        const cascadiaFontOnDisk = this.readFileOnDisk('Cascadia.woff2');

        const patchedHtml = html
            .replace(new RegExp('{{extensionPath}}', 'g'), this.context.extensionPath)
            .replace(new RegExp('{{virgilFont}}', 'g'), virgilFontOnDisk.toString())
            .replace(new RegExp('{{cascadiaFont}}', 'g'), cascadiaFontOnDisk.toString())
            .replace(new RegExp('{{styleScriptOnDisk}}', 'g'), styleScriptOnDisk.toString())
            .replace(new RegExp('{{chunkScript}}', 'g'), chunkScript.toString())
            .replace(new RegExp('{{runtimeScriptOnDisk}}', 'g'), runtimeScriptOnDisk.toString())
            .replace(new RegExp('{{mainScriptOnDisk}}', 'g'), mainScriptOnDisk.toString());

        return patchedHtml;
    }

    public resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        webviewPanel.webview.options = {
            enableScripts: true
        };

        webviewPanel.webview.html = this.createWebViewContent(webviewPanel.webview);

        this.postFileContentToWebView(document, webviewPanel);

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

    public async postFileContentToWebView(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        const fileContent = await vscode.workspace.fs.readFile(document.uri);

        if (fileContent) {
            // init data to extension
            webviewPanel.webview.postMessage({ command: 'loadLocalData', data: fileContent.toString() });
        }
    }
}
