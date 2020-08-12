import * as vscode from 'vscode';
import { join } from 'path';
import html from './webviewHtml.html';
import { EXCALIDRAW_DEFAULT_BACKGROUNDCOLOR } from './constants';

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
    private elements = [];
    private config = vscode.workspace.getConfiguration('excalidraw');
    private viewBackgroundColor = '';

    constructor(private context: vscode.ExtensionContext) {
        this.buildPath = join(context.extensionPath, 'excalidraw', 'build');
    }

    private readFileOnDisk(path: string) {
        return vscode.Uri.file(join(this.buildPath, path)).with({
            scheme: 'vscode-resource'
        });
    }
    private async updateExcalidrawContent(
        document: vscode.TextDocument,
        data: string,
        key: 'updateExcalidraw' | 'updateExcalidrawState'
    ) {
        // https://github.com/excalidraw/excalidraw/blob/c427aa3cce801bef4dd9107e1044d3a4f61a201e/src/data/json.ts#L12
        const parseData = JSON.parse(data);

        if (key === 'updateExcalidraw') {
            this.elements = parseData;
        }

        if (key === 'updateExcalidrawState') {
            this.viewBackgroundColor = parseData.viewBackgroundColor;
        };

        // TODO AppState, viewBackgroundColor
        const result = JSON.stringify({
            type: 'excalidraw',
            elements: this.elements.filter((element: any) => !element.isDeleted),
            appState: {
                viewBackgroundColor: this.viewBackgroundColor
            }
        });

        if (result === document.getText()) {
            return false;
        }

        const workspaceEdit = new vscode.WorkspaceEdit();

        workspaceEdit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            result
        );

        try {
            await vscode.workspace.applyEdit(workspaceEdit);
        } catch (error) {
            // ...
        }

        // const buf = Buffer.from(result);
        // vscode.workspace.fs.writeFile(document.uri, buf);
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
        const fontPathOnDisk = this.readFileOnDisk('fonts.css');

        // const patchedHtml = html
        //     // .replace(new RegExp('{{extensionPath}}', 'g'), this.buildPath)
        //     .replace(new RegExp('{{fontPath}}', 'g'), fontPathOnDisk.toString())
        //     .replace(new RegExp('{{virgilFont}}', 'g'), virgilFontOnDisk.toString())
        //     .replace(new RegExp('{{cascadiaFont}}', 'g'), cascadiaFontOnDisk.toString())
        //     .replace(new RegExp('{{styleScriptOnDisk}}', 'g'), styleScriptOnDisk.toString())
        //     .replace(new RegExp('{{chunkScript}}', 'g'), chunkScript.map(item => `${item.scheme}:/${item.path}`).join(','))
        //     .replace(new RegExp('{{runtimeScriptOnDisk}}', 'g'), runtimeScriptOnDisk.toString())
        //     .replace(new RegExp('{{mainScriptOnDisk}}', 'g'), mainScriptOnDisk.toString());

        // return patchedHtml;


        return `
            <!DOCTYPE html>
            <html lang="en">
            
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>ExcaliDraw</title>
            
                <link rel="stylesheet" href="${fontPathOnDisk}" />
                <style>
                    /* http://www.eaglefonts.com/fg-virgil-ttf-131249.htm */
                    @font-face {
                        font-family: 'Virgil';
                        src: url("${virgilFontOnDisk}");
                        font-display: swap;
                    }
            
                    /* https://github.com/microsoft/cascadia-code */
                    @font-face {
                        font-family: 'Cascadia';
                        src: url("${cascadiaFontOnDisk}");
                        font-display: swap;
                    }
                </style>
            
                <link href="${virgilFontOnDisk}" as="font" type="font/woff2" crossorigin="anonymous" />
                <link href="${cascadiaFontOnDisk}" as="font" type="font/woff2" crossorigin="anonymous" />
            
                <link rel="stylesheet" type="text/css" href="${styleScriptOnDisk}" />
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
                        pointer-events: none;
                    }
            
                    .LoadingMessage span {
                        background-color: rgba(255, 255, 255, 0.8);
                        border-radius: 5px;
                        padding: 0.8em 1.2em;
                        font-size: 1.3em;
                    }
            
                    .visually-hidden {
                        position: absolute !important;
                        height: 1px;
                        width: 1px;
                        overflow: hidden;
                        clip: rect(1px 1px 1px 1px);
                        clip: rect(1px, 1px, 1px, 1px);
                        white-space: nowrap;
                    }
            
                    .Stack_horizontal {
                        justify-content: start !important;
                    }
            
                    .App-menu_top>.Stack .Stack_horizontal>.ToolIcon_type_button:nth-child(1),
                    .App-menu_top>.Stack .Stack_horizontal>.ToolIcon_type_button:nth-child(4),
                    .App-menu_top>.Stack .Stack_horizontal>.ToolIcon_type_button:nth-child(5),
                    .App-menu_top>.Stack .Stack_horizontal>.ToolIcon_type_button:nth-child(6) {
                        display: none;
                    }
                </style>
            </head>
            
            <body>
                <div id="root">
                    <div class="LoadingMessage"><span>Loading scene...</span></div>
                </div>
            
            
                // <script src="${runtimeScriptOnDisk}"></script>
                // ${chunkScript.map((item) => `<script src="${item}"></script>`)}
                // <script src="${mainScriptOnDisk}"></script>
            
                <script>
                    (() => {
                        let initData = {};
            
                        // https://github.com/Microsoft/vscode/issues/48464
                        Object.defineProperty(document, 'cookie', { value: '' });
            
                        // message from vscode
                        window.addEventListener('message', event => {
                            const message = event.data; // The JSON data our extension sent
            
                            const data = message.data;
            
                            console.log('message ===>', message);
            
                            switch (message.command) {
                                case 'loadLocalData':
                                    try {
                                        initData = JSON.parse(message.data || '{}');
                                        initLocalStorage();
                                        initScript();
                                    } catch (error) {
                                        throw new Error(error);
                                    }
            
                                    break;
                            }
                        });
            
                        function initLocalStorage() {
                            const vscode = acquireVsCodeApi();
            
                            const storage = {};
                            const log = console.log;
                            const bridgedLocalStorage = {
                                getItem: function (key) {
                                    log('localStorage: get ' + key);
            
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
                                    log('localStorage: set ' + key + ' to ' + val);
            
                                    switch (key) {
                                        case 'excalidraw':
                                            vscode.postMessage({
                                                command: 'updateExcalidraw',
                                                data: val
                                            });
                                            break;
            
                                        case 'excalidraw-state':
                                            vscode.postMessage({
                                                command: 'updateExcalidrawState',
                                                data: val
                                            });
                                    }
            
                                    storage[key] = val;
                                },
                                removeItem: function (key) {
                                    log('localStorage: remove ' + key);
                                    delete storage[key];
                                }
                            };
            
                            Object.defineProperty(window, 'localStorage', {
                                value: bridgedLocalStorage
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
                        };
            
                        // rewrite command/ctrl + s
                        const isDarwin = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
                        const CTRL_OR_CMD = isDarwin ? 'metaKey' : 'ctrlKey';
            
                        function patchFn(originalFn) {
                            return function (...args) {
                                const [eventName, oldHandler] = args;
                                console.log("Intercepting addListener", args);
                                if (eventName === 'keydown') {
                                    args[1] = e => {
                                        if (e.key === "s" && e[CTRL_OR_CMD]) {
                                            console.log('command/ctrl + s');
                                            return false;
                                        }
                                        return oldHandler(e);
                                    }
                                }
                                return originalFn.apply(this, args);
                            }
                        }
            
                        document.addEventListener = patchFn(document.addEventListener);
                    })();
                </script>
            </body>
            
            </html>
        `

    }

    public resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(join(this.buildPath))]
        };

        webviewPanel.webview.html = this.createWebViewContent(webviewPanel.webview);

        this.postFileContentToWebView(document, webviewPanel);

        webviewPanel.onDidDispose(() => {
            // ..
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.command) {
                case 'updateExcalidraw':
                    this.updateExcalidrawContent(document, e.data, 'updateExcalidraw');
                    return;

                case 'updateExcalidrawState':
                    this.updateExcalidrawContent(document, e.data, 'updateExcalidrawState');
            }
        });
    }

    public async postFileContentToWebView(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        const fileContent = await vscode.workspace.fs.readFile(document.uri);

        if (fileContent.length !== 0) {
            // init data to extension
            webviewPanel.webview.postMessage({ command: 'loadLocalData', data: fileContent.toString() });
        } else {
            // empty data
            const result = JSON.stringify({
                type: 'excalidraw',
                elements: [],
                appState: {
                    viewBackgroundColor: this.config.get(EXCALIDRAW_DEFAULT_BACKGROUNDCOLOR)
                }
            });
            webviewPanel.webview.postMessage({ command: 'loadLocalData', data: result });
        }
    }
}
