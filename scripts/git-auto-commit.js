// Git auto-commit script: watches user/ and www/user directories and auto-commits changes
const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

const WATCH_DIRS = [
  path.join(__dirname, '..', 'user'),
  path.join(__dirname, '..', 'www', 'user')
];
let debounceTimer = null;

console.log('[git-auto-commit] Starting watcher on:', WATCH_DIRS);

// Initial status check
exec('git status', { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
  if (err) {
    console.error('[git-auto-commit] Error checking git status:', err.message);
    return;
  }
  console.log('[git-auto-commit] Current git status:', stdout.trim());
});

function commitChanges(filePath) {
  console.log('[git-auto-commit] Change detected:', filePath);

  // Debounce: wait 2 seconds before committing
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const date = new Date().toISOString();
    const commitMsg = `Update injection files: ${date}`;

    console.log('[git-auto-commit] Running git add and commit...');

    // Stage the changed file
    exec(`git add ${filePath}`, { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
      if (err) {
        console.error('[git-auto-commit] Error staging file:', err.message);
        return;
      }

      // Commit the changes
      exec(`git commit -m "${commitMsg}"`, { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
        if (err) {
          // Ignore "nothing to commit" error
          if (err.message.includes('nothing to commit')) {
            console.log('[git-auto-commit] Nothing to commit');
            return;
          }
          console.error('[git-auto-commit] Error committing:', err.message);
          return;
        }
        console.log('[git-auto-commit] Commit successful:', stdout.trim());
      });
    });
  }, 2000);
}

// Watch for file changes in user/ and www/user directories
const watcher = chokidar.watch(WATCH_DIRS, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

watcher
  .on('add', filePath => commitChanges(filePath))
  .on('change', filePath => commitChanges(filePath))
  .on('unlink', filePath => commitChanges(filePath))
  .on('error', error => console.error('[git-auto-commit] Watcher error:', error));

console.log('[git-auto-commit] Watching for changes. Press Ctrl+C to stop.');
