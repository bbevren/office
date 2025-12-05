// Service Worker for OnlyOffice Serverless
// Intercepts download requests and triggers actual file downloads

const DOWNLOAD_CACHE = new Map();

self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Service worker activated');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Log all POST requests for debugging
    if (event.request.method === 'POST') {
        console.log('[SW Fetch] POST request:', url.pathname);
    }
    
    // Intercept POST requests to /downloadas/
    if (event.request.method === 'POST' && url.pathname.includes('/downloadas/')) {
        console.log('[SW Intercept] ✓ Download request intercepted:', url.pathname);
        
        event.respondWith(
            (async () => {
                try {
                    // Forward the request to the server
                    console.log('[SW] Forwarding request to server...');
                    const response = await fetch(event.request.clone());
                    console.log('[SW] Got response, status:', response.status);
                    
                    const responseData = await response.clone().json();
                    console.log('[SW] Download response parsed:', responseData);
                    
                    // If we got a valid download URL, notify the client
                    if (responseData.error === 0 && responseData.url) {
                        console.log('[SW] Valid URL found, notifying clients...');
                        // Notify all clients about the download
                        const clients = await self.clients.matchAll();
                        console.log('[SW] Found', clients.length, 'clients to notify');
                        clients.forEach(client => {
                            console.log('[SW] Sending message to client:', responseData.url);
                            client.postMessage({
                                type: 'download-ready',
                                url: responseData.url,
                                fileType: responseData.fileType
                            });
                        });
                    } else {
                        console.log('[SW] No valid URL, error:', responseData.error);
                    }
                    
                    return response;
                } catch (err) {
                    console.error('[SW] Error processing download:', err);
                    throw err;
                }
            })()
        );
        return;
    }
    
    // Pass through all other requests
    // Don't call event.respondWith() to let the request pass through normally
});

self.addEventListener('message', (event) => {
    console.log('[SW] Received message:', event.data);
});
