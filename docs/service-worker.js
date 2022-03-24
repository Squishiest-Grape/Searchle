// give your cache a name
const cacheName = 'searchle-cache'

// put the static assets and routes you want to cache here
const filesToCache = [
  '.',
  'index.html',
  'help.txt',  
  'searchle.js',
  'wordlist.json',
  'images/favicon.ico',
  'images/Searchle512.png',
  'images/Searchle192.png',
]

// the event handler for the activate event
self.addEventListener('activate', e => self.clients.claim())

// the event handler for the install event 
// typically used to cache assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName)
    .then(cache => cache.addAll(filesToCache))
  )
})

// the fetch event handler, to intercept requests and serve all 
// static assets from the cache
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request)
    .catch(()=>caches.open(cacheName)
      .then(cache => caches.match(e.request))
    )
  )
})
