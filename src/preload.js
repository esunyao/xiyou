'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Simple injection manager: loads user JS/CSS from local files via IPC (sandbox mode)
async function safeReadFile(filename) {
	try {
		const content = await ipcRenderer.invoke('read-injection-file', filename);
		return content || '';
	} catch (_) {
		return '';
	}
}

function injectCss(cssText) {
	if (!cssText) return;
	const style = document.createElement('style');
	style.setAttribute('data-xiyou-inject', 'css');
	style.textContent = cssText;
	document.documentElement.appendChild(style);
}

function injectJs(jsText) {
	if (!jsText) return;
	try {
		// Execute in page context
		const script = document.createElement('script');
		script.setAttribute('data-xiyou-inject', 'js');
		script.textContent = jsText;
		document.documentElement.appendChild(script);
		script.remove();
	} catch (err) {
		console.error('Injection error:', err);
	}
}

async function runInjection() {
	// Only inject on target domain
	const currentUrl = window.location.href;
	if (!currentUrl.includes('xiyouyingyu.com')) {
		console.log('[xiyou] Not on target domain, skipping injection');
		return;
	}

	try {
		const css = await safeReadFile('inject.css');
		const js = await safeReadFile('inject.js');
		
		console.log('[xiyou] Files loaded successfully, proceeding with injection');
		
		if (css) {
			injectCss(css);
			console.log('[xiyou] CSS injection complete');
		}
		
		if (js) {
			injectJs(js);
			console.log('[xiyou] JS injection complete');
		}
	} catch (error) {
		console.error('[xiyou] Injection error:', error);
	}
}

// 在URL变化时重新注入（用于SPA导航）
let lastUrl = location.href;
const observer = new MutationObserver(() => {
	if (location.href !== lastUrl) {
		lastUrl = location.href;
		console.log('[xiyou] URL changed, re-running injection...');
		runInjection();
	}
});

observer.observe(document, { subtree: true, childList: true });

// 在页面完全加载后执行注入
window.addEventListener('load', () => {
	console.log('[xiyou] Page loaded, running injection...');
	runInjection();
});

// DOMContentLoaded 可能更早触发注入
document.addEventListener('DOMContentLoaded', () => {
	console.log('[xiyou] DOM ready, running injection...');
	runInjection();
});

// Initialize when ready
function init() {
	// Listen for manual re-run from the menu
	ipcRenderer.on('injection:run', () => {
		runInjection();
	});

	// Also run on navigation (for SPAs like Vue Router)
	let lastUrl = location.href;

	function checkUrlChange() {
		const url = location.href;
		if (url !== lastUrl) {
			lastUrl = url;
			// Re-run injection immediately when URL changes
			runInjection();
		}
	}

	// Listen for various navigation events
	window.addEventListener('popstate', checkUrlChange);
	window.addEventListener('hashchange', checkUrlChange);

	// Override pushState and replaceState to catch SPA navigation
	const originalPushState = history.pushState;
	const originalReplaceState = history.replaceState;

	history.pushState = function(...args) {
		originalPushState.apply(history, args);
		checkUrlChange();
	};

	history.replaceState = function(...args) {
		originalReplaceState.apply(history, args);
		checkUrlChange();
	};

	// Run injection when page becomes visible (handles tab switching)
	if (document.addEventListener) {
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) {
				runInjection();
			}
		});
	}

	// Initial injection
	runInjection();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
	window.addEventListener('DOMContentLoaded', init);
} else {
	// DOM already loaded - run immediately
	init();
}

// Expose a small API for debugging from devtools if needed
contextBridge.exposeInMainWorld('xiyou', {
	reloadInjection: () => ipcRenderer.send('injection:run'),
	runInjection: () => runInjection(),
});


