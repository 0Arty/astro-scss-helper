const vscode = require('vscode')
const fs = require('fs')

// filepath -> Set<className>
const fileClassMap = new Map()
let classIndex = new Set()

// ─────────────────────────────────────────
// Парсинг класів з вмісту файлу
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// Оновлення індексу для одного файлу
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// Початкова індексація всіх astro файлів
// ─────────────────────────────────────────
async function scanWorkspace() {
   fileClassMap.clear()
   classIndex.clear()

   const uris = await vscode.workspace.findFiles(
      '**/*.astro',
      '**/node_modules/**',
   )

   // Читаємо файли паралельно, але чанками по 20 щоб не перевантажити ФС
   const CHUNK = 20
   for (let i = 0; i < uris.length; i += CHUNK) {
      const chunk = uris.slice(i, i + CHUNK)
      await Promise.all(chunk.map(updateFile))
   }

   rebuildIndex()
   console.log(
      `[astro-scss-helper] Проіндексовано ${uris.length} файлів, ` +
         `знайдено ${classIndex.size} класів`,
   )
}

// ─────────────────────────────────────────
// Activate
// ─────────────────────────────────────────
function activate(context) {
   console.log('[astro-scss-helper] Активовано')

   // Індексуємо при старті
   scanWorkspace()

   // Watcher — реагуємо тільки на змінений файл, не перескануємо всі
   const watcher = vscode.workspace.createFileSystemWatcher('**/*.astro')
   watcher.onDidChange((uri) => updateFile(uri))
   watcher.onDidCreate((uri) => updateFile(uri))
   watcher.onDidDelete((uri) => removeFile(uri))
   context.subscriptions.push(watcher)

   // Completion provider для SCSS
   // Тригер '.' — спрацьовує коли пишеш крапку
   const provider = vscode.languages.registerCompletionItemProvider(
      ['scss', 'css'],
      {
         provideCompletionItems(document, position) {
            const lineText = document.lineAt(position).text
            const charBefore = lineText[position.character - 1]

            // Підказуємо тільки якщо перед курсором є '.' або вже є '.foo'
            if (
               charBefore !== '.' &&
               !/^\s*\.[a-z0-9_-]*$/i.test(
                  lineText.slice(0, position.character),
               )
            ) {
               return undefined
            }

            return [...classIndex].map((cls) => {
               const item = new vscode.CompletionItem(
                  `.${cls}`,
                  vscode.CompletionItemKind.Value,
               )
               // insertText без крапки — крапка вже набрана як тригер
               item.insertText = cls
               item.detail = '⬡ Astro class'
               item.documentation = new vscode.MarkdownString(
                  `Клас знайдено в \`.astro\` файлах проєкту`,
               )
               // Висока пріоритетність в списку
               item.sortText = `0_${cls}`
               return item
            })
         },
      },
      '.', // trigger character
   )

   context.subscriptions.push(provider)

   // Команда для ручного ресканування
   const rescanCommand = vscode.commands.registerCommand(
      'astro-scss-helper.rescan',
      async () => {
         await scanWorkspace()
         vscode.window.showInformationMessage(
            `[Astro SCSS Helper] Знайдено ${classIndex.size} класів`,
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
