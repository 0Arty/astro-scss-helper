const vscode = require('vscode')
const fs = require('fs')

// filepath -> Set<className>
const fileClassMap = new Map()
let classIndex = new Set()

// Parsing classes from file content
function extractClasses(content) {
   const classes = new Set()

   // class="foo bar"  class='foo bar'  class={`foo bar`}
   const classAttr = /class\s*=\s*["'`]([^"'`]+)["'`]/g
   let m
   while ((m = classAttr.exec(content)) !== null) {
      m[1]
         .trim()
         .split(/\s+/)
         .forEach((c) => c && classes.add(c))
   }

   // class:list={['foo', 'bar', { baz: true }]}
   const classListAttr = /class:list\s*=\s*\{([^}]+)\}/g
   while ((m = classListAttr.exec(content)) !== null) {
      const inner = m[1]
      const strings = /['"`]([^'"`\s]+)['"`]/g
      let s
      while ((s = strings.exec(inner)) !== null) {
         s[1] && classes.add(s[1])
      }
   }

   return classes
}

// Updating the index for a single file

async function updateFile(uri) {
   try {
      const content = await fs.promises.readFile(uri.fsPath, 'utf-8')
      const classes = extractClasses(content)

      if (classes.size === 0) {
         fileClassMap.delete(uri.fsPath)
      } else {
         fileClassMap.set(uri.fsPath, classes)
      }
   } catch {
      fileClassMap.delete(uri.fsPath)
   }

   rebuildIndex()
}

function removeFile(uri) {
   fileClassMap.delete(uri.fsPath)
   rebuildIndex()
}

function rebuildIndex() {
   classIndex.clear()
   for (const classes of fileClassMap.values()) {
      for (const c of classes) {
         classIndex.add(c)
      }
   }
}

// Initial indexing of all astro files
async function scanWorkspace() {
   fileClassMap.clear()
   classIndex.clear()

   const uris = await vscode.workspace.findFiles(
      '**/*.astro',
      '**/node_modules/**',
   )

   // We read the files in parallel, but in chunks of 20 so as not to overload the file system
   const CHUNK = 20
   for (let i = 0; i < uris.length; i += CHUNK) {
      const chunk = uris.slice(i, i + CHUNK)
      await Promise.all(chunk.map(updateFile))
   }

   rebuildIndex()
   console.log(
      `[astro-scss-helper] ${uris.length} files indexed, ` +
         `${classIndex.size} classes found`,
   )
}

// ─────────────────────────────────────────
// Activate
// ─────────────────────────────────────────
function activate(context) {
   console.log('[astro-scss-helper] Active')

   // Index on start
   scanWorkspace()

   // Watcher — react only on changed file
   const watcher = vscode.workspace.createFileSystemWatcher('**/*.astro')
   watcher.onDidChange((uri) => updateFile(uri))
   watcher.onDidCreate((uri) => updateFile(uri))
   watcher.onDidDelete((uri) => removeFile(uri))
   context.subscriptions.push(watcher)

   // Completion provider for SCSS
   // Trigger '.'
   const provider = vscode.languages.registerCompletionItemProvider(
      ['scss', 'css'],
      {
         provideCompletionItems(document, position) {
            const lineText = document.lineAt(position).text
            const charBefore = lineText[position.character - 1]

            // Only suggest if there is a ‘.’ before the cursor or if ‘.foo’ is already present
            if (
               charBefore !== '.' &&
               !/^\s*\.[a-z0-9_-]*$/i.test(
                  lineText.slice(0, position.character),
               )
            ) {
               return undefined
            }

            // Find the start of the current word containing a period
            // For example: “   .fie|ld” → the range from the position of the period to the cursor
            const linePrefix = lineText.slice(0, position.character)
            const dotIndex = linePrefix.lastIndexOf('.')
            const replaceStart = new vscode.Position(position.line, dotIndex)
            const replaceEnd = position

            return [...classIndex].map((cls) => {
               const item = new vscode.CompletionItem(
                  `.${cls}`,
                  vscode.CompletionItemKind.Value,
               )
               // Replace from the period to the cursor — .className is inserted
               item.textEdit = vscode.TextEdit.replace(
                  new vscode.Range(replaceStart, replaceEnd),
                  `.${cls}`,
               )
               item.detail = '⬡ Astro class'
               item.documentation = new vscode.MarkdownString(
                  `The class was found in the \`.astro\` project files`,
               )
               item.sortText = `0_${cls}`
               return item
            })
         },
      },
      '.', // trigger character
   )

   context.subscriptions.push(provider)

   // Command for manual rescan
   const rescanCommand = vscode.commands.registerCommand(
      'astro-scss-helper.rescan',
      async () => {
         await scanWorkspace()
         vscode.window.showInformationMessage(
            `[Astro SCSS Helper] Found ${classIndex.size} classes`,
         )
      },
   )
   context.subscriptions.push(rescanCommand)
}

function deactivate() {
   fileClassMap.clear()
   classIndex.clear()
}

module.exports = { activate, deactivate }
