// RM Volley Dashboard - Enhanced Service Worker
// Strategic caching for offline capability

const STATIC_CACHE = 'rm-volley-static-v3';
const DATA_CACHE = 'rm-volley-data-v3';

// Critical static assets that should be cached immediately
const staticAssets = [
  '/',
  '/index.html',
  '/styles.css',
  '/live-match.css',
  '/privacy-footer.css',
  '/app.js',
  '/live-match.js',
  '/utils.js',
  '/firebase-config.js',
  '/manifest.json'
];

// Data files that should be cached with network-first strategy
const dataAssets = [
  '/classifica.json',
  '/Gare.xls',
  '/config.json'
];

// Media assets
const mediaAssets = [
  '/media/icon-72x72.png',
  '/media/icon-96x96.png',
  '/media/icon-128x128.png',
  '/media/icon-144x144.png',
  '/media/icon-152x152.png',
  '/media/icon-192x192.png',
  '/media/icon-384x384.png',
  '/media/icon-512x512.png',
  '/media/rmlogo.png'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Caching static assets');
        return cache.addAll(staticAssets);
      }),
      caches.open(DATA_CACHE).then(cache => {
        console.log('📊 Pre-caching data files');
        return cache.addAll(dataAssets);
      }),
      caches.open(STATIC_CACHE).then(cache => {
        console.log('🖼️ Caching media assets');
        return cache.addAll(mediaAssets);
      })
    ])
    .then(() => {
      console.log('✅ Service Worker installation complete');
      return self.skipWaiting();
    })
    .catch(err => {
      console.log('❌ Cache install failed:', err);
    })
  );
});

// Fetch event - strategic caching strategy
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Handle different request types with different strategies
  if (isDataRequest(request.url)) {
    // Network-first for data files to ensure freshness
    event.respondWith(networkFirstStrategy(request));
  } else if (isStaticRequest(request.url)) {
    // Cache-first for static assets
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Network-only for everything else (Firebase, external APIs)
    event.respondWith(fetch(request));
  }
});

// Check if request is for data files
function isDataRequest(url) {
  return dataAssets.some(asset => url.includes(asset)) || 
         url.includes('.json') || 
         url.includes('.xls');
}

// Check if request is for static assets
function isStaticRequest(url) {
  return staticAssets.some(asset => url.includes(asset)) ||
         mediaAssets.some(asset => url.includes(asset)) ||
         url.includes('.css') || 
         url.includes('.js') ||
         url.includes('.png') ||
         url.includes('/media/');
}

// Network-first strategy (for data files)
function networkFirstStrategy(request) {
  return fetch(request)
    .then(response => {
      // Cache the fresh response
      if (response.ok) {
        const responseToCache = response.clone();
        caches.open(DATA_CACHE).then(cache => {
          cache.put(request, responseToCache);
        });
      }
      return response;
    })
    .catch(() => {
      // If network fails, try cache
      return caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('📴 Serving from cache (offline):', request.url);
            return cachedResponse;
          }
          // Return offline page if nothing in cache
          return new Response('Offline - No cached data available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
    });
}

// Cache-first strategy (for static assets)
function cacheFirstStrategy(request) {
  return caches.match(request)
    .then(response => {
      if (response) {
        return response;
      }
      
      // If not in cache, fetch from network
      return fetch(request).then(response => {
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      });
    });
}

          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      const cacheWhitelist = [STATIC_CACHE, DATA_CACHE];
      
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker activation complete');
      return self.clients.claim();
    })
  );
});
