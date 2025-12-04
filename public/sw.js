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
    
    // Intercept POST requests to /downloadas/
    if (event.request.method === 'POST' && url.pathname.includes('/downloadas/')) {
        console.log('[SW] Intercepting download request:', url.pathname);
        
        event.respondWith(
            (async () => {
                // Forward the request to the server
                const response = await fetch(event.request.clone());
                const responseData = await response.clone().json();
                
                console.log('[SW] Download response:', responseData);
                
                // If we got a valid download URL, fetch the file and notify the client
                if (responseData.error === 0 && responseData.url) {
                    // Notify all clients about the download
                    const clients = await self.clients.matchAll();
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'download-ready',
                            url: responseData.url,
                            fileType: responseData.fileType
                        });
                    });
                }
                
                return response;
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
