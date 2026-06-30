// KT-Media Tech — shared interactions

document.addEventListener('DOMContentLoaded', function () {
  // mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    if (!nav.id) nav.id = 'main-nav';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.classList.toggle('nav-open', isOpen);
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
      });
    });
  }

  // footer year
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var KT_CONFIG = Object.assign({
    analytics: {
      ga4MeasurementId: '',
      matomoUrl: '',
      matomoSiteId: ''
    },
    crm: {
      webhookUrl: '',
      authToken: ''
    },
    chat: {
      enabled: true,
      provider: 'custom',
      tawkPropertyId: '',
      tawkWidgetId: '',
      crispWebsiteId: ''
    }
  }, window.KT_CONFIG || {});

  function injectScript(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function initAnalyticsProviders() {
    var gaId = (((KT_CONFIG.analytics || {}).ga4MeasurementId) || '').trim();
    if (gaId) {
      injectScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId));
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', gaId, { send_page_view: false });
    }

    var matomoUrl = (((KT_CONFIG.analytics || {}).matomoUrl) || '').trim();
    var matomoSiteId = (((KT_CONFIG.analytics || {}).matomoSiteId) || '').toString().trim();
    if (matomoUrl && matomoSiteId) {
      var u = matomoUrl.replace(/\/$/, '') + '/';
      window._paq = window._paq || [];
      window._paq.push(['setTrackerUrl', u + 'matomo.php']);
      window._paq.push(['setSiteId', matomoSiteId]);
      window._paq.push(['trackPageView']);
      window._paq.push(['enableLinkTracking']);
      injectScript(u + 'matomo.js');
    }
  }

  function readLocalJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (e) {
      return fallback;
    }
  }

  function writeLocalJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Ignore storage quota/private mode write errors.
    }
  }

  function updateWebhookLog(result) {
    var log = readLocalJSON('kt_webhook_log', { sent: 0, failed: 0, lastStatus: 'none', lastAt: '' });
    if (result === 'sent') log.sent += 1;
    if (result === 'failed') log.failed += 1;
    log.lastStatus = result;
    log.lastAt = new Date().toISOString();
    writeLocalJSON('kt_webhook_log', log);
  }

  function queueWebhook(payload) {
    var queue = readLocalJSON('kt_webhook_queue', []);
    queue.push(payload);
    if (queue.length > 100) queue = queue.slice(queue.length - 100);
    writeLocalJSON('kt_webhook_queue', queue);
  }

  function postWebhook(payload) {
    var webhookUrl = (((KT_CONFIG.crm || {}).webhookUrl) || '').trim();
    if (!webhookUrl || !window.fetch) {
      queueWebhook(payload);
      updateWebhookLog('failed');
      return Promise.resolve(false);
    }
    var headers = { 'Content-Type': 'application/json' };
    var token = (((KT_CONFIG.crm || {}).authToken) || '').trim();
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('Webhook status ' + res.status);
      updateWebhookLog('sent');
      return true;
    }).catch(function () {
      queueWebhook(payload);
      updateWebhookLog('failed');
      return false;
    });
  }

  function flushWebhookQueue() {
    var queue = readLocalJSON('kt_webhook_queue', []);
    if (!queue.length) return;
    writeLocalJSON('kt_webhook_queue', []);
    queue.forEach(function (payload) {
      postWebhook(payload).then(function (ok) {
        if (!ok) {
          // Keep failed entries queued for retry.
          queueWebhook(payload);
        }
      });
    });
  }

  function sendCRMLead(type, payload) {
    var leadPayload = {
      type: type,
      source: 'website',
      page: window.location.pathname,
      at: new Date().toISOString(),
      data: payload || {}
    };
    return postWebhook(leadPayload);
  }

  // Basic client-side analytics funnel (stored locally for static hosting).
  function trackEvent(name, payload) {
    var eventPayload = payload || {};
    try {
      var events = JSON.parse(localStorage.getItem('kt_events') || '[]');
      events.push({
        name: name,
        payload: eventPayload,
        at: new Date().toISOString()
      });
      if (events.length > 200) events = events.slice(events.length - 200);
      localStorage.setItem('kt_events', JSON.stringify(events));
    } catch (e) {
      // Swallow storage errors for private mode/full storage.
    }

    if (window.gtag) {
      window.gtag('event', name, eventPayload);
    }
    if (window._paq && window._paq.push) {
      window._paq.push(['trackEvent', 'website', name, JSON.stringify(eventPayload)]);
    }
  }

  function initChatWidget() {
    var chatConfig = KT_CONFIG.chat || {};
    if (chatConfig.provider === 'tawk' && chatConfig.tawkPropertyId && chatConfig.tawkWidgetId) {
      injectScript('https://embed.tawk.to/' + encodeURIComponent(chatConfig.tawkPropertyId) + '/' + encodeURIComponent(chatConfig.tawkWidgetId));
      return;
    }
    if (chatConfig.provider === 'crisp' && chatConfig.crispWebsiteId) {
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = chatConfig.crispWebsiteId;
      injectScript('https://client.crisp.chat/l.js');
      return;
    }
    if (!chatConfig.enabled || document.querySelector('#live-chat-toggle')) return;

    var widget = document.createElement('div');
    widget.className = 'live-chat-widget';
    widget.innerHTML =
      '<button id="live-chat-toggle" class="live-chat-toggle" aria-label="Open live chat">Live Chat</button>' +
      '<div id="live-chat-panel" class="live-chat-panel hidden">' +
        '<button type="button" id="live-chat-close" class="live-chat-close" aria-label="Close live chat">&times;</button>' +
        '<h3>Talk to KT-Media Tech</h3>' +
        '<p>Start a real-time conversation with our team.</p>' +
        '<form id="live-chat-form">' +
          '<input type="text" id="chat-name" placeholder="Your name" required>' +
          '<input type="tel" id="chat-phone" placeholder="Phone number" required>' +
          '<textarea id="chat-message" rows="3" placeholder="How can we help?" required></textarea>' +
          '<button type="submit" class="btn btn-cyan btn-block">Start Chat</button>' +
        '</form>' +
        '<a class="chat-whatsapp-link" href="https://wa.me/256702493682" target="_blank" rel="noopener">Continue on WhatsApp</a>' +
      '</div>';
    document.body.appendChild(widget);

    var toggleBtn = document.querySelector('#live-chat-toggle');
    var chatPanel = document.querySelector('#live-chat-panel');
    if (toggleBtn && chatPanel) {
      toggleBtn.addEventListener('click', function () {
        chatPanel.classList.toggle('hidden');
        trackEvent('chat_widget_toggle', { open: !chatPanel.classList.contains('hidden') });
      });
    }

    var closeBtn = document.querySelector('#live-chat-close');
    if (closeBtn && chatPanel) {
      closeBtn.addEventListener('click', function () {
        chatPanel.classList.add('hidden');
        trackEvent('chat_widget_toggle', { open: false, source: 'close_button' });
      });
    }

    var liveChatForm = document.querySelector('#live-chat-form');
    if (liveChatForm) {
      liveChatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (document.querySelector('#chat-name') || {}).value || '';
        var phone = (document.querySelector('#chat-phone') || {}).value || '';
        var message = (document.querySelector('#chat-message') || {}).value || '';
        var chatLead = { name: name.trim(), phone: phone.trim(), message: message.trim(), channel: 'live-chat-widget' };
        trackEvent('chat_lead', chatLead);
        sendCRMLead('chat_lead', chatLead);

        var waText = [
          'Live Chat Request',
          'Name: ' + chatLead.name,
          'Phone: ' + chatLead.phone,
          'Message: ' + chatLead.message
        ].join('\n');
        window.open('https://wa.me/256702493682?text=' + encodeURIComponent(waText), '_blank', 'noopener');
        liveChatForm.reset();
      });
    }
  }

  initAnalyticsProviders();
  flushWebhookQueue();
  initChatWidget();
  trackEvent('page_view', { path: window.location.pathname, title: document.title });

  function parseUgPrice(text) {
    return parseInt((text || '').replace(/[^\d]/g, ''), 10) || 0;
  }

  function normalizeText(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function levenshtein(a, b) {
    var m = a.length;
    var n = b.length;
    var dp = [];
    for (var i = 0; i <= m; i += 1) {
      dp[i] = [];
      dp[i][0] = i;
    }
    for (var j = 0; j <= n; j += 1) dp[0][j] = j;
    for (i = 1; i <= m; i += 1) {
      for (j = 1; j <= n; j += 1) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function fuzzyIncludes(haystack, query) {
    if (!query) return true;
    if (haystack.indexOf(query) !== -1) return true;
    if (query.length < 3) return false;
    var words = haystack.split(' ');
    for (var i = 0; i < words.length; i += 1) {
      if (Math.abs(words[i].length - query.length) > 2) continue;
      if (levenshtein(words[i], query) <= 1) return true;
    }
    return false;
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var activeModal = document.querySelector('.modal[style*="display: flex"]');
    if (activeModal) closeModal(activeModal);
  });

  // FAQ accordion
  document.querySelectorAll('.accordion-item').forEach(function (item) {
    var btn = item.querySelector('.accordion-q');
    var panel = item.querySelector('.accordion-a');
    if (!btn || !panel) return;
    if (!panel.id) panel.id = 'accordion-panel-' + Math.random().toString(36).slice(2);
    btn.setAttribute('aria-controls', panel.id);
    btn.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.accordion-item.open').forEach(function (el) {
        if (el !== item) {
          el.classList.remove('open');
          el.querySelector('.accordion-a').style.maxHeight = null;
          var openBtn = el.querySelector('.accordion-q');
          if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
        }
      });
      if (isOpen) {
        item.classList.remove('open');
        panel.style.maxHeight = null;
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // product / service category filter + smart shop search + faceted filtering
  var filterBtns = document.querySelectorAll('.tag-btn[data-filter]');
  var filterItems = document.querySelectorAll('[data-cat]');
  if (filterBtns.length && filterItems.length) {
    var productSearch = document.querySelector('#product-search');
    var productCount = document.querySelector('[data-product-count]');
    var productEmpty = document.querySelector('#product-empty');
    var activeFilter = document.querySelector('.tag-btn.active[data-filter]');
    var toolbar = document.querySelector('.shop-toolbar');
    var priceFilter = null;
    var availabilityFilter = null;
    var searchSuggest = null;

    if (toolbar && !document.querySelector('#price-filter')) {
      var advancedFilters = document.createElement('div');
      advancedFilters.className = 'shop-advanced-controls';
      advancedFilters.innerHTML =
        '<label class="filter-group" for="price-filter">' +
          '<span>Price</span>' +
          '<select id="price-filter">' +
            '<option value="all">All prices</option>' +
            '<option value="0-200000">Under UGX 200,000</option>' +
            '<option value="200000-1000000">UGX 200,000 - 1,000,000</option>' +
            '<option value="1000000-999999999">Above UGX 1,000,000</option>' +
          '</select>' +
        '</label>' +
        '<label class="filter-group" for="availability-filter">' +
          '<span>Availability</span>' +
          '<select id="availability-filter">' +
            '<option value="all">All stock states</option>' +
            '<option value="in-stock">In stock</option>' +
            '<option value="low-stock">Low stock</option>' +
            '<option value="preorder">Pre-order</option>' +
          '</select>' +
        '</label>';
      toolbar.appendChild(advancedFilters);
    }

    priceFilter = document.querySelector('#price-filter');
    availabilityFilter = document.querySelector('#availability-filter');

    if (productSearch) {
      var searchWrap = productSearch.closest('.shop-search');
      if (searchWrap && !searchWrap.querySelector('#search-suggest')) {
        searchSuggest = document.createElement('div');
        searchSuggest.className = 'search-suggest hidden';
        searchSuggest.id = 'search-suggest';
        searchWrap.appendChild(searchSuggest);
      }
    }

    function setStockBadge(item, idx) {
      var body = item.querySelector('.product-body');
      if (!body) return;
      var state = item.getAttribute('data-stock');
      if (!state) {
        state = (idx % 7 === 0) ? 'preorder' : ((idx % 4 === 0) ? 'low-stock' : 'in-stock');
        item.setAttribute('data-stock', state);
      }
      if (!body.querySelector('.stock-badge')) {
        var badge = document.createElement('span');
        badge.className = 'stock-badge stock-' + state;
        badge.textContent = state === 'in-stock' ? 'In stock' : (state === 'low-stock' ? 'Low stock' : 'Pre-order');
        body.insertBefore(badge, body.firstChild);
      }
    }

    filterItems.forEach(setStockBadge);

    function renderSuggestions(query) {
      if (!searchSuggest) return;
      var q = normalizeText(query);
      if (!q || q.length < 2) {
        searchSuggest.classList.add('hidden');
        searchSuggest.innerHTML = '';
        return;
      }
      var picks = [];
      filterItems.forEach(function (item) {
        var title = normalizeText((item.querySelector('h3') || {}).textContent || '');
        if (title.indexOf(q) !== -1 || fuzzyIncludes(title, q)) {
          picks.push((item.querySelector('h3') || {}).textContent || '');
        }
      });
      picks = picks.slice(0, 5);
      if (!picks.length) {
        searchSuggest.classList.add('hidden');
        searchSuggest.innerHTML = '';
        return;
      }
      searchSuggest.innerHTML = picks.map(function (label) {
        return '<button type="button" class="suggest-item">' + label + '</button>';
      }).join('');
      searchSuggest.classList.remove('hidden');
      searchSuggest.querySelectorAll('.suggest-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (productSearch) productSearch.value = btn.textContent;
          searchSuggest.classList.add('hidden');
          updateProductResults();
        });
      });
    }

    function inPriceRange(priceValue) {
      if (!priceFilter || priceFilter.value === 'all') return true;
      var parts = priceFilter.value.split('-');
      var min = parseInt(parts[0], 10) || 0;
      var max = parseInt(parts[1], 10) || Number.MAX_SAFE_INTEGER;
      return priceValue >= min && priceValue <= max;
    }

    function inAvailability(item) {
      if (!availabilityFilter || availabilityFilter.value === 'all') return true;
      return item.getAttribute('data-stock') === availabilityFilter.value;
    }

    function updateProductResults() {
      var f = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
      var q = productSearch ? normalizeText(productSearch.value) : '';
      var shown = 0;
      filterItems.forEach(function (item) {
        var inCat = f === 'all' || item.getAttribute('data-cat') === f;
        var searchable = normalizeText(item.textContent);
        var titleText = normalizeText((item.querySelector('h3') || {}).textContent || '');
        var priceText = (item.querySelector('.product-price') || {}).textContent || '';
        var numericPrice = parseUgPrice(priceText);
        var matchesSearch = !q || searchable.indexOf(q) !== -1 || fuzzyIncludes(titleText, q);
        if (inCat && matchesSearch && inPriceRange(numericPrice) && inAvailability(item)) {
          item.classList.remove('hidden');
          shown += 1;
        } else {
          item.classList.add('hidden');
        }
      });
      if (productCount) productCount.textContent = shown;
      if (productEmpty) productEmpty.classList.toggle('hidden', shown !== 0);
      renderSuggestions(q);
    }

    filterBtns.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        activeFilter = btn;
        updateProductResults();
      });
    });
    if (productSearch) {
      productSearch.addEventListener('input', updateProductResults);
      productSearch.addEventListener('focus', function () {
        renderSuggestions(productSearch.value);
      });
      productSearch.addEventListener('blur', function () {
        setTimeout(function () {
          if (searchSuggest) searchSuggest.classList.add('hidden');
        }, 120);
      });
    }
    if (priceFilter) priceFilter.addEventListener('change', updateProductResults);
    if (availabilityFilter) availabilityFilter.addEventListener('change', updateProductResults);
    updateProductResults();
  }

  /* =========================================================
     PRODUCT DESCRIPTIONS DATABASE
     ========================================================= */
  var productDescriptions = {
    'Core i5 Business Laptop': 'Perfect for everyday office work, web browsing, and video calls. Features 8GB RAM for smooth multitasking, 256GB SSD for fast boot and app loading, and a 14" display ideal for portability and desk use.',
    'Core i7 Student/Pro Laptop': 'Designed for students, designers, and professionals. With 16GB RAM and 512GB SSD, it handles demanding applications like Adobe Creative Suite, 3D modeling, and coding environments. The 15.6" display provides excellent screen real estate.',
    'Refurbished Laptop (Grade A)': 'Certified Grade A refurbished units that have been thoroughly tested and restored. Available in various RAM/storage combinations (4–8GB RAM). Great budget option for students and basic computing needs.',
    'Desktop Bundle + Monitor': 'Complete workstation setup including tower unit, 19" monitor, keyboard, and mouse. Ideal for offices, schools, and retail shops. All components fully compatible and tested together.',
    'Office Mini Tower (CPU only)': 'Compact desktop tower perfect for data entry, accounting, office administration, and email work. Energy-efficient and space-saving. Does not include monitor, keyboard, or mouse.',
    'UPS / Power Backup': 'Protects your computer during Kampala power cuts and surges. Prevents data loss and hard drive damage. Keeps system running long enough for safe shutdown. Available in various capacities (800VA to 2000VA).',
    'Laptop Bags & Sleeves': 'Padded, water-resistant protection for 13" to 15.6" laptops. Multiple styles including shoulder bags, backpacks, and sleeves. Durable materials withstand daily travel and use.',
    'Keyboards & Mice': 'Wired and wireless options available. Ergonomic designs to reduce strain during long work sessions. Compact travel options and full-size desktop sets. Compatible with Windows, Mac, and Linux.',
    'Chargers, Cables & Adapters': 'Universal laptop chargers supporting most major brands. HDMI, USB-C, and VGA adapters for connecting to projectors and displays. High-quality cables that last. All tested for safety.',
    'All-in-One Printer (Print/Scan/Copy)': 'Space-saving solution for small offices and home use. Prints, scans, and copies in color and black & white. Compact design with automatic document feeder. Compatible with Windows and Mac.',
    'Ink & Toner Cartridges': 'Original and compatible cartridges for most common office printers (HP, Canon, Brother, Epson). Genuine products with warranty. Compatible replacements available at lower cost.',
    'Routers & WiFi Boosters': 'Home and office routers with dual-band WiFi for strong, stable connections. Range extenders to eliminate dead zones. Network cabling and installation support available.',
    'CCTV Camera Kit (4-Camera)': 'Complete security system including 4 cameras, DVR recorder, cabling, and installation. Remote viewing from your phone via app. Night vision and motion detection. Professional installation included.',
    'Single CCTV Camera + Setup': 'Entry-level security solution ideal for monitoring one entrance or counter area. Professional installation included. Remote mobile viewing available. Night vision enabled.',
    'Windows Activation (Genuine License)': 'Genuine Windows operating system activation with official license key. Professional installation by certified technician. Includes setup assistance and basic system configuration.',
    'Microsoft Office License + Install': 'Licensed Microsoft Office (Word, Excel, PowerPoint) installed and activated on your computer. Includes basic setup support and training on common features.',
    'Phone Screen Replacement': 'Professional screen replacement for common Android and iPhone models. Fast turnaround (while you wait where possible). All replaced screens tested before handover. Warranty on replacement.',
    'Phone Battery Replacement': 'Professional battery replacement restoring full battery life to devices that drain quickly or shut down unexpectedly. Original and quality compatible batteries available. Tested for safety and performance.',
    'Basic Mobile App (Android)': 'A simple, functional Android app for your small business or personal project. Includes basic UI/UX design, essential features, and Google Play Store listing support. Ideal for startups and MVPs.',
    'Business App (Android & iOS)': 'A more complete, professional app with backend server, user accounts, authentication, admin dashboard, and analytics. Supports both Android and iOS platforms. Includes 6 months of maintenance and updates.',
    'AI Basics Workshop (Half-Day)': 'Hands-on introduction to using AI tools like ChatGPT, Gemini, and Midjourney for work and business. No experience needed. Covers practical applications for productivity, content creation, and problem-solving. Certificate included.',
    'AI for Teams (Corporate Training)': 'Customized on-site training for your entire team on using AI tools to enhance daily work productivity. Includes hands-on exercises, real-world scenarios, and follow-up resources. Tailored to your industry and use cases.'
  };

  /* =========================================================
     ENHANCED SHOPPING CART SYSTEM v2
     With product details modal, floating cart widget, and quantity controls
     ========================================================= */

  var cart = {
    items: JSON.parse(localStorage.getItem('kt_cart') || '[]'),
    
    add: function(product) {
      var existing = this.items.find(function(item) { return item.id === product.id; });
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
      } else {
        product.qty = 1;
        this.items.push(product);
      }
      this.save();
      this.updateFloatingCart();
    },
    
    remove: function(productId) {
      this.items = this.items.filter(function(item) { return item.id !== productId; });
      this.save();
      this.updateFloatingCart();
    },
    
    updateQty: function(productId, qty) {
      var item = this.items.find(function(item) { return item.id === productId; });
      if (item) {
        item.qty = parseInt(qty) || 1;
        if (item.qty <= 0) this.remove(productId);
        else {
          this.save();
          this.updateFloatingCart();
        }
      }
    },
    
    clear: function() {
      this.items = [];
      this.save();
      this.updateFloatingCart();
    },
    
    save: function() {
      localStorage.setItem('kt_cart', JSON.stringify(this.items));
    },
    
    getTotal: function() {
      return this.items.reduce(function(sum, item) {
        var price = parseInt(item.price.replace(/[^\d]/g, '')) || 0;
        return sum + (price * (item.qty || 1));
      }, 0);
    },

    updateFloatingCart: function() {
      var floatingCart = document.querySelector('.floating-cart');
      if (!floatingCart) return;
      
      if (this.items.length === 0) {
        floatingCart.style.display = 'none';
      } else {
        floatingCart.style.display = 'flex';
        var badge = floatingCart.querySelector('.cart-badge');
        if (badge) {
          var totalItems = this.items.reduce(function(sum, item) { return sum + (item.qty || 1); }, 0);
          badge.textContent = totalItems;
        }
      }
    }
  };

  // Create floating cart widget HTML
  if (!document.querySelector('.floating-cart')) {
    var floatingCartHTML = document.createElement('div');
    floatingCartHTML.className = 'floating-cart';
    floatingCartHTML.style.display = 'none';
    floatingCartHTML.innerHTML = 
      '<button class="cart-float-btn" aria-label="Open cart" title="View cart">' +
        '<svg viewBox="0 0 24 24"><path d="M7 4h10v3H7zM5 9h14l-1.5 9h-11z"/></svg>' +
        '<span class="cart-badge">0</span>' +
      '</button>';
    document.body.appendChild(floatingCartHTML);
  }

  // Create product details modal
  if (!document.querySelector('#product-details-modal')) {
    var detailsModal = document.createElement('div');
    detailsModal.id = 'product-details-modal';
    detailsModal.className = 'modal';
    detailsModal.innerHTML = 
      '<div class="modal-overlay" id="product-modal-overlay"></div>' +
      '<div class="modal-content modal-product-details">' +
        '<button class="modal-close" id="product-modal-close" aria-label="Close">&times;</button>' +
        '<div class="product-details-body">' +
          '<h2 id="detail-title"></h2>' +
          '<div class="detail-meta">' +
            '<span id="detail-category" class="detail-tag"></span>' +
            '<span id="detail-price" class="detail-price"></span>' +
          '</div>' +
          '<p id="detail-description"></p>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-cyan cart-from-modal" data-product-id=""><svg viewBox="0 0 24 24" style="width:18px; margin-right:8px;"><path d="M7 4h10v3H7zM5 9h14l-1.5 9h-11z"/></svg>Add to Cart</button>' +
            '<button class="btn btn-outline" id="detail-close-btn">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(detailsModal);
  }

  // Create cart popup modal
  if (!document.querySelector('#cart-popup-modal')) {
    var cartPopup = document.createElement('div');
    cartPopup.id = 'cart-popup-modal';
    cartPopup.className = 'modal';
    cartPopup.innerHTML = 
      '<div class="modal-overlay" id="cart-popup-overlay"></div>' +
      '<div class="modal-content cart-popup-content">' +
        '<button class="modal-close" id="cart-popup-close" aria-label="Close">&times;</button>' +
        '<h2>Shopping Cart</h2>' +
        '<div id="cart-popup-items" class="cart-popup-items"></div>' +
        '<div class="cart-popup-summary">' +
          '<div class="summary-line"><span>Total:</span><span id="popup-total">UGX 0</span></div>' +
        '</div>' +
        '<button class="btn btn-gold btn-block" id="cart-checkout-btn">Proceed to Checkout</button>' +
      '</div>';
    document.body.appendChild(cartPopup);
  }

  // Create checkout modal
  if (!document.querySelector('#checkout-modal-v2')) {
    var checkoutModal = document.createElement('div');
    checkoutModal.id = 'checkout-modal-v2';
    checkoutModal.className = 'modal';
    checkoutModal.innerHTML = 
      '<div class="modal-overlay" id="checkout-modal-overlay"></div>' +
      '<div class="modal-content">' +
        '<button class="modal-close" id="checkout-close" aria-label="Close">&times;</button>' +
        '<h2>Complete Your Order</h2>' +
        '<p style="color:#666; margin-bottom:20px;">Provide your contact details to receive your order quote and delivery information.</p>' +
        '<form id="checkout-form-v2">' +
          '<div class="form-group">' +
            '<label for="customer-name">Full Name *</label>' +
            '<input type="text" id="customer-name" required placeholder="Your full name">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="customer-phone">Phone Number *</label>' +
            '<input type="tel" id="customer-phone" required placeholder="+256702493682">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="customer-email">Email Address</label>' +
            '<input type="email" id="customer-email" placeholder="your@email.com">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="customer-business">Organization Name</label>' +
            '<input type="text" id="customer-business" placeholder="Optional">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="customer-address">Delivery Address</label>' +
            '<input type="text" id="customer-address" placeholder="Kampala location">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="delivery-method">Delivery Method</label>' +
            '<select id="delivery-method">' +
              '<option value="pickup">Store Pickup (Free)</option>' +
              '<option value="kampala">Kampala Delivery (UGX 20,000)</option>' +
              '<option value="upcountry">Upcountry Delivery (UGX 45,000)</option>' +
            '</select>' +
            '<p class="delivery-hint" id="delivery-estimate">Estimated delivery: same day for pickup.</p>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="customer-notes">Special Requests</label>' +
            '<textarea id="customer-notes" rows="3" placeholder="Any special requirements?"></textarea>' +
          '</div>' +
          '<button type="submit" class="btn btn-gold btn-block">Submit Order</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(checkoutModal);
  }

  // Setup product cards with eye icon, compare, and cart icon
  var productRegistry = {};

  function saveRecentlyViewed(product) {
    try {
      var seen = JSON.parse(localStorage.getItem('kt_recently_viewed') || '[]');
      seen = seen.filter(function (x) { return x.id !== product.id; });
      seen.unshift(product);
      if (seen.length > 4) seen = seen.slice(0, 4);
      localStorage.setItem('kt_recently_viewed', JSON.stringify(seen));
      renderRecentlyViewed();
    } catch (e) {
      // Ignore storage failures.
    }
  }

  function renderRecentlyViewed() {
    var host = document.querySelector('#recently-viewed');
    if (!host) return;
    var list = JSON.parse(localStorage.getItem('kt_recently_viewed') || '[]');
    if (!list.length) {
      host.classList.add('hidden');
      return;
    }
    host.classList.remove('hidden');
    host.innerHTML = list.map(function (item) {
      return '<article class="recent-item">' +
        '<h4>' + item.title + '</h4>' +
        '<p>' + item.category + '</p>' +
        '<span>' + item.price + '</span>' +
      '</article>';
    }).join('');
  }

  function getCompareItems() {
    var ids = JSON.parse(localStorage.getItem('kt_compare') || '[]');
    return ids.map(function (id) { return productRegistry[id]; }).filter(Boolean);
  }

  function syncCompareButtons() {
    var ids = JSON.parse(localStorage.getItem('kt_compare') || '[]');
    document.querySelectorAll('.compare-btn').forEach(function (btn) {
      var id = btn.getAttribute('data-product-id');
      var active = ids.indexOf(id) !== -1;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.textContent = active ? 'Compared' : 'Compare';
    });
    var compareLaunch = document.querySelector('#compare-launch');
    if (compareLaunch) {
      compareLaunch.textContent = 'Compare (' + ids.length + ')';
      compareLaunch.disabled = ids.length < 2;
    }
  }

  function renderCompareModal() {
    var wrap = document.querySelector('#compare-items');
    if (!wrap) return;
    var items = getCompareItems();
    if (items.length < 2) {
      wrap.innerHTML = '<p class="compare-empty">Pick at least two products to compare.</p>';
      return;
    }
    wrap.innerHTML = items.map(function (item) {
      return '<div class="compare-col">' +
        '<h3>' + item.title + '</h3>' +
        '<p class="cmp-cat">' + item.category + '</p>' +
        '<p class="cmp-price">' + item.price + '</p>' +
        '<p>' + (productDescriptions[item.title] || 'Quality product from KT-Media Tech.') + '</p>' +
      '</div>';
    }).join('');
  }

  if (!document.querySelector('#compare-modal') && document.querySelector('#product-grid')) {
    var compareModal = document.createElement('div');
    compareModal.id = 'compare-modal';
    compareModal.className = 'modal';
    compareModal.innerHTML =
      '<div class="modal-overlay" id="compare-overlay"></div>' +
      '<div class="modal-content compare-modal-content">' +
        '<button class="modal-close" id="compare-close" aria-label="Close">&times;</button>' +
        '<h2>Compare Products</h2>' +
        '<div id="compare-items" class="compare-grid"></div>' +
      '</div>';
    document.body.appendChild(compareModal);
  }

  if (document.querySelector('.shop-toolbar') && !document.querySelector('#compare-launch')) {
    var compareLaunchBtn = document.createElement('button');
    compareLaunchBtn.id = 'compare-launch';
    compareLaunchBtn.type = 'button';
    compareLaunchBtn.className = 'btn btn-navy';
    compareLaunchBtn.textContent = 'Compare (0)';
    compareLaunchBtn.disabled = true;
    compareLaunchBtn.addEventListener('click', function () {
      var modal = document.querySelector('#compare-modal');
      if (!modal) return;
      renderCompareModal();
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
      trackEvent('open_compare_modal');
    });
    document.querySelector('.shop-toolbar').appendChild(compareLaunchBtn);
  }

  if (document.querySelector('#product-grid') && !document.querySelector('#recently-viewed')) {
    var recentWrap = document.createElement('div');
    recentWrap.className = 'recent-wrap';
    recentWrap.innerHTML =
      '<h3>Recently Viewed</h3>' +
      '<div id="recently-viewed" class="recent-grid hidden"></div>';
    var emptyState = document.querySelector('#product-empty');
    if (emptyState && emptyState.parentNode) emptyState.parentNode.insertBefore(recentWrap, emptyState.nextSibling);
  }

  document.querySelectorAll('.product-card:not([data-setup])').forEach(function(card, idx) {
    card.setAttribute('data-setup', '1');
    
    var productTitle = card.querySelector('h3');
    var productPrice = card.querySelector('.product-price');
    var productCat = card.querySelector('.product-cat');
    
    if (!productTitle || !productPrice) return;
    
    var productId = 'prod-' + idx;
    var productBody = card.querySelector('.product-body');
    var productObj = {
      id: productId,
      title: productTitle.textContent.trim(),
      price: productPrice.textContent.trim(),
      category: (productCat ? productCat.textContent.trim() : 'Product')
    };
    productRegistry[productId] = productObj;
    
    // Create action buttons container
    var actionBtns = document.createElement('div');
    actionBtns.className = 'product-actions';
    
    // Eye icon for product details
    var eyeBtn = document.createElement('button');
    eyeBtn.className = 'product-btn eye-btn';
    eyeBtn.innerHTML = '👁️';
    eyeBtn.setAttribute('aria-label', 'View product details');
    eyeBtn.setAttribute('data-product-id', productId);
    eyeBtn.type = 'button';
    
    // Cart icon
    var cartBtn = document.createElement('button');
    cartBtn.className = 'product-btn cart-btn';
    cartBtn.innerHTML = '🛒';
    cartBtn.setAttribute('aria-label', 'Add to cart');
    cartBtn.setAttribute('data-product-id', productId);
    cartBtn.type = 'button';

    // Compare button
    var compareBtn = document.createElement('button');
    compareBtn.className = 'product-btn compare-btn';
    compareBtn.setAttribute('data-product-id', productId);
    compareBtn.type = 'button';
    compareBtn.textContent = 'Compare';
    compareBtn.setAttribute('aria-pressed', 'false');
    
    actionBtns.appendChild(eyeBtn);
    actionBtns.appendChild(compareBtn);
    actionBtns.appendChild(cartBtn);
    productBody.appendChild(actionBtns);
    
    // Eye button: show product details
    eyeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var title = productTitle.textContent.trim();
      var modal = document.querySelector('#product-details-modal');
      document.querySelector('#detail-title').textContent = title;
      document.querySelector('#detail-category').textContent = (productCat ? productCat.textContent.trim() : 'Product');
      document.querySelector('#detail-price').textContent = productPrice.textContent.trim();
      document.querySelector('#detail-description').textContent = productDescriptions[title] || 'Premium quality product from KT-Media Tech. Contact us for more details.';
      document.querySelector('.cart-from-modal').setAttribute('data-product-id', productId);
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
      saveRecentlyViewed(productObj);
      trackEvent('view_product', { id: productId, title: title });
    });

    compareBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var ids = JSON.parse(localStorage.getItem('kt_compare') || '[]');
      if (ids.indexOf(productId) === -1) {
        if (ids.length >= 4) ids = ids.slice(1);
        ids.push(productId);
      } else {
        ids = ids.filter(function (id) { return id !== productId; });
      }
      localStorage.setItem('kt_compare', JSON.stringify(ids));
      syncCompareButtons();
      trackEvent('toggle_compare', { id: productId, selected: ids.indexOf(productId) !== -1 });
    });
    
    // Cart button: add to cart
    cartBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var product = {
        id: productId,
        title: productTitle.textContent.trim(),
        price: productPrice.textContent.trim(),
        category: (productCat ? productCat.textContent.trim() : 'Product'),
        qty: 1
      };
      cart.add(product);
      trackEvent('add_to_cart', { id: productId, title: product.title });
      cartBtn.innerHTML = '✓ 🛒';
      setTimeout(function() {
        cartBtn.innerHTML = '🛒';
      }, 1000);
    });
  });

  // Floating cart button click
  var floatingCartBtn = document.querySelector('.floating-cart');
  if (floatingCartBtn) {
    floatingCartBtn.addEventListener('click', function() {
      document.querySelector('#cart-popup-modal').style.display = 'flex';
      document.body.classList.add('modal-open');
      renderCartPopup();
    });
  }

  // Render cart popup with quantity controls
  function renderCartPopup() {
    var container = document.querySelector('#cart-popup-items');
    container.innerHTML = '';
    
    if (cart.items.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#999; padding:30px 0;">Your cart is empty</p>';
      return;
    }
    
    cart.items.forEach(function(item) {
      var price = parseInt(item.price.replace(/[^\d]/g, '')) || 0;
      var itemTotal = price * (item.qty || 1);
      
      var itemEl = document.createElement('div');
      itemEl.className = 'cart-popup-item';
      itemEl.innerHTML = 
        '<div class="item-header">' +
          '<div><strong>' + item.title + '</strong><div style="font-size:0.85rem; color:#999;">' + item.category + '</div></div>' +
          '<button type="button" class="delete-cart-item" data-id="' + item.id + '" aria-label="Remove">✕</button>' +
        '</div>' +
        '<div class="item-footer">' +
          '<div class="qty-control">' +
            '<button type="button" class="qty-btn qty-minus" data-id="' + item.id + '">−</button>' +
            '<input type="number" value="' + (item.qty || 1) + '" class="qty-input" data-id="' + item.id + '" min="1">' +
            '<button type="button" class="qty-btn qty-plus" data-id="' + item.id + '">+</button>' +
          '</div>' +
          '<span class="item-price">' + itemTotal.toLocaleString() + ' UGX</span>' +
        '</div>';
      
      container.appendChild(itemEl);
    });
    
    // Quantity control handlers
    document.querySelectorAll('.qty-minus').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        var item = cart.items.find(function(i) { return i.id === id; });
        if (item && item.qty > 1) {
          cart.updateQty(id, item.qty - 1);
          renderCartPopup();
        }
      });
    });
    
    document.querySelectorAll('.qty-plus').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        var item = cart.items.find(function(i) { return i.id === id; });
        if (item) {
          cart.updateQty(id, item.qty + 1);
          renderCartPopup();
        }
      });
    });
    
    document.querySelectorAll('.qty-input').forEach(function(input) {
      input.addEventListener('change', function() {
        var id = input.getAttribute('data-id');
        var qty = parseInt(input.value) || 1;
        if (qty > 0) cart.updateQty(id, qty);
        renderCartPopup();
      });
    });
    
    document.querySelectorAll('.delete-cart-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        cart.remove(btn.getAttribute('data-id'));
        if (cart.items.length === 0) {
          document.querySelector('#cart-popup-modal').style.display = 'none';
          document.body.classList.remove('modal-open');
        } else {
          renderCartPopup();
        }
      });
    });
    
    // Update total
    var total = cart.getTotal();
    document.querySelector('#popup-total').textContent = total.toLocaleString() + ' UGX';
  }

  // Modal close handlers
  ['#product-modal-close', '#detail-close-btn'].forEach(function(selector) {
    var btn = document.querySelector(selector);
    if (btn) {
      btn.addEventListener('click', function() {
        document.querySelector('#product-details-modal').style.display = 'none';
        document.body.classList.remove('modal-open');
      });
    }
  });
  
  var productOverlay = document.querySelector('#product-modal-overlay');
  if (productOverlay) {
    productOverlay.addEventListener('click', function() {
      closeModal(document.querySelector('#product-details-modal'));
    });
  }
  
  var cartFromModal = document.querySelector('.cart-from-modal');
  if (cartFromModal) {
    cartFromModal.addEventListener('click', function() {
      var productId = this.getAttribute('data-product-id');
      var title = document.querySelector('#detail-title').textContent;
      var price = document.querySelector('#detail-price').textContent;
      var category = document.querySelector('#detail-category').textContent;
      
      var product = { id: productId, title: title, price: price, category: category, qty: 1 };
      cart.add(product);
      closeModal(document.querySelector('#product-details-modal'));
      trackEvent('add_to_cart', { id: productId, title: title, source: 'details_modal' });
    });
  }
  
  var cartPopupClose = document.querySelector('#cart-popup-close');
  if (cartPopupClose) {
    cartPopupClose.addEventListener('click', function() {
      closeModal(document.querySelector('#cart-popup-modal'));
    });
  }
  
  var cartPopupOverlay = document.querySelector('#cart-popup-overlay');
  if (cartPopupOverlay) {
    cartPopupOverlay.addEventListener('click', function() {
      closeModal(document.querySelector('#cart-popup-modal'));
    });
  }

  var compareClose = document.querySelector('#compare-close');
  if (compareClose) {
    compareClose.addEventListener('click', function () {
      closeModal(document.querySelector('#compare-modal'));
    });
  }
  var compareOverlay = document.querySelector('#compare-overlay');
  if (compareOverlay) {
    compareOverlay.addEventListener('click', function () {
      closeModal(document.querySelector('#compare-modal'));
    });
  }

  // Checkout button
  var checkoutBtn = document.querySelector('#cart-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function() {
      document.querySelector('#cart-popup-modal').style.display = 'none';
      document.querySelector('#checkout-modal-v2').style.display = 'flex';
      trackEvent('begin_checkout', { items: cart.items.length, total: cart.getTotal() });
    });
  }

  // Close checkout modal
  var checkoutClose = document.querySelector('#checkout-close');
  if (checkoutClose) {
    checkoutClose.addEventListener('click', function() {
      document.querySelector('#checkout-modal-v2').style.display = 'none';
      document.body.classList.remove('modal-open');
    });
  }

  var checkoutOverlay = document.querySelector('#checkout-modal-overlay');
  if (checkoutOverlay) {
    checkoutOverlay.addEventListener('click', function() {
      closeModal(document.querySelector('#checkout-modal-v2'));
    });
  }

  var deliveryMethod = document.querySelector('#delivery-method');
  var deliveryEstimate = document.querySelector('#delivery-estimate');
  if (deliveryMethod && deliveryEstimate) {
    var updateDeliveryHint = function () {
      if (deliveryMethod.value === 'pickup') {
        deliveryEstimate.textContent = 'Estimated delivery: same day for pickup.';
      } else if (deliveryMethod.value === 'kampala') {
        deliveryEstimate.textContent = 'Estimated delivery: within Kampala in 2-6 hours.';
      } else {
        deliveryEstimate.textContent = 'Estimated delivery: upcountry dispatch in 1-2 working days.';
      }
    };
    deliveryMethod.addEventListener('change', updateDeliveryHint);
    updateDeliveryHint();
  }

  // Checkout form submission
  var checkoutForm = document.querySelector('#checkout-form-v2');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      var name = document.querySelector('#customer-name').value.trim();
      var phone = document.querySelector('#customer-phone').value.trim();
      var email = document.querySelector('#customer-email').value.trim();
      var business = document.querySelector('#customer-business').value.trim();
      var address = document.querySelector('#customer-address').value.trim();
      var notes = document.querySelector('#customer-notes').value.trim();
      var delivery = (document.querySelector('#delivery-method') || {}).value || 'pickup';
      
      if (!name || !phone) {
        alert('Name and phone are required.');
        return;
      }
      
      var cartSummary = cart.items.map(function(item) {
        return item.title + ' (x' + (item.qty || 1) + ') — ' + item.price;
      }).join('\n');
      
      var total = cart.getTotal();
      
      var msg = [
        '🛒 *NEW ORDER from KT-Media Tech Website*',
        '',
        '*Customer:*',
        name + ' | ' + phone,
        email ? 'Email: ' + email : '',
        business ? 'Org: ' + business : '',
        address ? 'Location: ' + address : '',
        'Delivery: ' + (delivery === 'pickup' ? 'Store Pickup' : (delivery === 'kampala' ? 'Kampala Delivery' : 'Upcountry Delivery')),
        '',
        '*Items:*',
        cartSummary,
        '',
        '*Total: UGX ' + total.toLocaleString() + '*',
        notes ? '\n*Notes: ' + notes + '*' : ''
      ].filter(Boolean).join('\n');
      
      window.open('https://wa.me/256702493682?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      sendCRMLead('order_submit', {
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        organization: business,
        address: address,
        delivery: delivery,
        notes: notes,
        items: cart.items,
        total: total
      });
      
      cart.clear();
      checkoutForm.reset();
      closeModal(document.querySelector('#checkout-modal-v2'));
      alert('Order sent! Our team will contact you soon.');
      cart.updateFloatingCart();
      trackEvent('submit_order', { items: cartSummary.split('\n').length, total: total, delivery: delivery });
    });
  }

  // FAQ quick search for faster support discovery.
  var faqItems = document.querySelectorAll('.accordion-item');
  if (faqItems.length && !document.querySelector('#faq-search')) {
    var faqHost = faqItems[0].parentNode;
    var faqSearchWrap = document.createElement('div');
    faqSearchWrap.className = 'faq-search-wrap';
    faqSearchWrap.innerHTML =
      '<label class="shop-search faq-search" for="faq-search">' +
        '<span>Search FAQ</span>' +
        '<input type="search" id="faq-search" placeholder="Type a question keyword..." autocomplete="off">' +
      '</label>' +
      '<div class="faq-search-count" id="faq-search-count">Showing all questions</div>';
    faqHost.insertBefore(faqSearchWrap, faqItems[0]);

    var faqSearch = document.querySelector('#faq-search');
    var faqCount = document.querySelector('#faq-search-count');
    faqSearch.addEventListener('input', function () {
      var q = normalizeText(faqSearch.value);
      var shown = 0;
      faqItems.forEach(function (item) {
        var text = normalizeText(item.textContent);
        var match = !q || text.indexOf(q) !== -1 || fuzzyIncludes(text, q);
        item.classList.toggle('hidden', !match);
        if (match) shown += 1;
      });
      faqCount.textContent = q ? ('Showing ' + shown + ' matching question' + (shown === 1 ? '' : 's')) : 'Showing all questions';
    });
  }

  // Progressive image performance improvements.
  document.querySelectorAll('img').forEach(function (img, idx) {
    if (!img.getAttribute('loading')) {
      img.setAttribute('loading', idx < 3 ? 'eager' : 'lazy');
    }
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  syncCompareButtons();
  renderRecentlyViewed();

  // Initialize floating cart visibility
  cart.updateFloatingCart();

  // Scroll reveal for content blocks.
  var revealItems = document.querySelectorAll('.card, .product-card, .quote-card, .step, .split-media, .section-head, .price-table, .contact-info-card, .dash-card');
  if ('IntersectionObserver' in window) {
    revealItems.forEach(function (el) { el.classList.add('reveal-on-scroll'); });
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });
    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }

  // Scroll reveal for content blocks.
  var revealItems = document.querySelectorAll('.card, .product-card, .quote-card, .step, .split-media, .section-head, .price-table, .contact-info-card, .dash-card');
  if ('IntersectionObserver' in window) {
    revealItems.forEach(function (el) { el.classList.add('reveal-on-scroll'); });
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });
    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }


  // Send contact form enquiries through WhatsApp on static hosting.
  var form = document.querySelector('#contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msgBox = document.querySelector('#form-success');
      var name = (document.querySelector('#name') || {}).value || '';
      var phone = (document.querySelector('#phone') || {}).value || '';
      var email = (document.querySelector('#email') || {}).value || '';
      var subject = (document.querySelector('#subject') || {}).value || '';
      var message = (document.querySelector('#message') || {}).value || '';
      var text = [
        'Hello KT-Media Tech, I would like help with an enquiry.',
        '',
        'Name: ' + name.trim(),
        'Phone: ' + phone.trim(),
        email.trim() ? 'Email: ' + email.trim() : '',
        'Subject: ' + subject.trim(),
        '',
        message.trim()
      ].filter(Boolean).join('\n');
      var lead = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        channel: 'contact_form'
      };
      trackEvent('lead_submit', { channel: 'contact_form', subject: lead.subject });
      sendCRMLead('contact_form', lead);
      window.open('https://wa.me/256702493682?text=' + encodeURIComponent(text), '_blank', 'noopener');
      form.reset();
      if (msgBox) {
        msgBox.classList.remove('hidden');
        msgBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  /* =========================================================
     CUSTOMER PORTAL — DEMO ONLY
     No real backend, authentication, or data storage.
     Uses sessionStorage purely so the demo persists while you
     click between login.html and portal.html in one browser tab.
     Replace this entire block when wiring up a real backend.
     ========================================================= */

  var DEMO_USER = {
    name: 'Patricia Namuli',
    email: 'demo@ktmediatech.ug',
    plan: 'Office Plan',
    accountNo: 'KT-00231'
  };

  var DEMO_DEVICES = [
    { name: 'HP ProBook 450 G8', tag: 'Laptop · Office #1', status: 'Active' },
    { name: 'Dell Desktop Optiplex', tag: 'Desktop · Reception', status: 'Active' },
    { name: 'Canon All-in-One Printer', tag: 'Printer · Office #1', status: 'Under maintenance plan' }
  ];

  var DEMO_TICKETS_SEED = [
    { id: 'TCK-1042', title: 'Laptop overheating after 20 minutes', device: 'HP ProBook 450 G8', status: 'progress', date: '18 Jun 2026' },
    { id: 'TCK-1038', title: 'Printer not connecting to WiFi', device: 'Canon All-in-One Printer', status: 'resolved', date: '09 Jun 2026' },
    { id: 'TCK-1031', title: 'Desktop won\u2019t boot after power cut', device: 'Dell Desktop Optiplex', status: 'resolved', date: '02 Jun 2026' }
  ];

  // ---- LOGIN PAGE ----
  var loginForm = document.querySelector('#login-form');
  if (loginForm) {
    var loginError = document.querySelector('#login-error');
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      // DEMO: any non-empty email + password logs in.
      var email = document.querySelector('#login-email').value.trim();
      var pass = document.querySelector('#login-password').value.trim();
      if (!email || !pass) {
        if (loginError) loginError.classList.add('show');
        return;
      }
      sessionStorage.setItem('pt_demo_logged_in', '1');
      window.location.href = 'portal.html';
    });
  }

  // ---- PORTAL DASHBOARD PAGE ----
  var dashWrap = document.querySelector('.dash-wrap');
  if (dashWrap) {
    if (sessionStorage.getItem('pt_demo_logged_in') !== '1') {
      window.location.href = 'login.html';
      return;
    }

    function appendText(parent, tag, className, text) {
      var el = document.createElement(tag);
      if (className) el.className = className;
      el.textContent = text;
      parent.appendChild(el);
      return el;
    }

    function safeStatus(status) {
      return ['open', 'progress', 'resolved'].indexOf(status) === -1 ? 'open' : status;
    }

    // Seed tickets into sessionStorage on first visit this session
    if (!sessionStorage.getItem('pt_demo_tickets')) {
      sessionStorage.setItem('pt_demo_tickets', JSON.stringify(DEMO_TICKETS_SEED));
    }

    // Fill user info placeholders
    document.querySelectorAll('[data-user-name]').forEach(function (el) { el.textContent = DEMO_USER.name; });
    document.querySelectorAll('[data-user-plan]').forEach(function (el) { el.textContent = DEMO_USER.plan; });
    document.querySelectorAll('[data-user-account]').forEach(function (el) { el.textContent = DEMO_USER.accountNo; });
    document.querySelectorAll('[data-user-initial]').forEach(function (el) { el.textContent = DEMO_USER.name.charAt(0); });

    var dashNav = document.querySelector('.dash-nav');
    var dashPanelsHost = document.querySelector('.dash-grid > div');
    if (dashNav && dashPanelsHost && !document.querySelector('.dash-nav button[data-panel="analytics"]')) {
      var analyticsBtn = document.createElement('button');
      analyticsBtn.setAttribute('data-panel', 'analytics');
      analyticsBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 19h16v2H4zM6 10h3v7H6zm5-4h3v11h-3zm5 6h3v5h-3z"/></svg>Analytics';
      dashNav.appendChild(analyticsBtn);

      var analyticsPanel = document.createElement('div');
      analyticsPanel.className = 'dash-panel';
      analyticsPanel.id = 'panel-analytics';
      analyticsPanel.innerHTML =
        '<div class="dash-card analytics-card">' +
          '<h2>Conversion Dashboard</h2>' +
          '<p class="sub">Live funnel metrics from GA4/Matomo mirrored in local event logs.</p>' +
          '<div class="summary-row analytics-row">' +
            '<div class="summary-tile"><div class="num" id="conv-visits">0</div><div class="lbl">Page Views</div></div>' +
            '<div class="summary-tile"><div class="num" id="conv-product-views">0</div><div class="lbl">Product Views</div></div>' +
            '<div class="summary-tile"><div class="num" id="conv-add-to-cart">0</div><div class="lbl">Add to Cart</div></div>' +
          '</div>' +
          '<div class="summary-row analytics-row">' +
            '<div class="summary-tile"><div class="num" id="conv-checkout">0</div><div class="lbl">Checkout Starts</div></div>' +
            '<div class="summary-tile"><div class="num" id="conv-orders">0</div><div class="lbl">Orders</div></div>' +
            '<div class="summary-tile"><div class="num" id="conv-leads">0</div><div class="lbl">Leads (All)</div></div>' +
          '</div>' +
          '<div class="table-wrap" style="margin-top:8px;">' +
            '<table class="price-table">' +
              '<thead><tr><th>Step</th><th>Count</th><th>Step Conversion</th></tr></thead>' +
              '<tbody>' +
                '<tr><td>Product View -> Add to Cart</td><td id="conv-step-cart">0</td><td id="conv-rate-cart">0%</td></tr>' +
                '<tr><td>Add to Cart -> Checkout</td><td id="conv-step-checkout">0</td><td id="conv-rate-checkout">0%</td></tr>' +
                '<tr><td>Checkout -> Order</td><td id="conv-step-order">0</td><td id="conv-rate-order">0%</td></tr>' +
              '</tbody>' +
            '</table>' +
          '</div>' +
          '<div class="badge-row" style="margin-top:14px;">' +
            '<span class="badge">Webhook sent: <strong id="crm-sent">0</strong></span>' +
            '<span class="badge">Webhook failed: <strong id="crm-failed">0</strong></span>' +
            '<span class="badge">Queued leads: <strong id="crm-queue">0</strong></span>' +
          '</div>' +
        '</div>';
      dashPanelsHost.appendChild(analyticsPanel);
    }

    // Sidebar tab switching
    var navButtons = document.querySelectorAll('.dash-nav button[data-panel]');
    var panels = document.querySelectorAll('.dash-panel');
    navButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        navButtons.forEach(function (b) { b.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var target = document.querySelector('#panel-' + btn.getAttribute('data-panel'));
        if (target) target.classList.add('active');
        if (btn.getAttribute('data-panel') === 'analytics') {
          renderConversionDashboard();
        }
      });
    });

    function countEvent(name) {
      var events = readLocalJSON('kt_events', []);
      return events.filter(function (e) { return e.name === name; }).length;
    }

    function rate(part, whole) {
      if (!whole) return '0%';
      return ((part / whole) * 100).toFixed(1) + '%';
    }

    function setText(sel, value) {
      var el = document.querySelector(sel);
      if (el) el.textContent = value;
    }

    function renderConversionDashboard() {
      var pageViews = countEvent('page_view');
      var productViews = countEvent('view_product');
      var addToCart = countEvent('add_to_cart');
      var checkoutStarts = countEvent('begin_checkout');
      var orders = countEvent('submit_order');
      var leads = countEvent('lead_submit') + countEvent('chat_lead') + countEvent('ticket_submit');
      var webhookLog = readLocalJSON('kt_webhook_log', { sent: 0, failed: 0 });
      var webhookQueue = readLocalJSON('kt_webhook_queue', []);

      setText('#conv-visits', pageViews);
      setText('#conv-product-views', productViews);
      setText('#conv-add-to-cart', addToCart);
      setText('#conv-checkout', checkoutStarts);
      setText('#conv-orders', orders);
      setText('#conv-leads', leads);

      setText('#conv-step-cart', addToCart);
      setText('#conv-step-checkout', checkoutStarts);
      setText('#conv-step-order', orders);
      setText('#conv-rate-cart', rate(addToCart, productViews));
      setText('#conv-rate-checkout', rate(checkoutStarts, addToCart));
      setText('#conv-rate-order', rate(orders, checkoutStarts));

      setText('#crm-sent', webhookLog.sent || 0);
      setText('#crm-failed', webhookLog.failed || 0);
      setText('#crm-queue', webhookQueue.length || 0);
    }
    renderConversionDashboard();

    // Render devices
    var deviceList = document.querySelector('#device-list');
    if (deviceList) {
      deviceList.innerHTML = '';
      DEMO_DEVICES.forEach(function (d) {
        var row = document.createElement('div');
        row.className = 'device-row';
        var main = document.createElement('div');
        appendText(main, 'div', 'device-name', d.name);
        appendText(main, 'div', 'device-meta', d.tag);
        row.appendChild(main);
        appendText(row, 'span', 'badge', d.status);
        deviceList.appendChild(row);
      });
    }
    var deviceCount = document.querySelector('#summary-devices');
    if (deviceCount) deviceCount.textContent = DEMO_DEVICES.length;

    // Render tickets
    function renderTickets() {
      var tickets = JSON.parse(sessionStorage.getItem('pt_demo_tickets') || '[]');
      var list = document.querySelector('#ticket-list');
      var openCount = tickets.filter(function (t) { return t.status !== 'resolved'; }).length;
      var openEl = document.querySelector('#summary-open');
      if (openEl) openEl.textContent = openCount;
      var totalEl = document.querySelector('#summary-total');
      if (totalEl) totalEl.textContent = tickets.length;
      if (!list) return;
      if (!tickets.length) {
        list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><p>No issues reported yet.</p></div>';
        return;
      }
      var statusLabel = { open: 'Open', progress: 'In Progress', resolved: 'Resolved' };
      list.innerHTML = '';
      tickets.forEach(function (t) {
        var status = safeStatus(t.status);
        var row = document.createElement('div');
        row.className = 'ticket-row';
        var main = document.createElement('div');
        main.className = 'ticket-main';
        appendText(main, 'span', 'ticket-id', t.id);
        appendText(main, 'span', 'ticket-title', t.title);
        appendText(main, 'span', 'ticket-meta', t.device + ' · reported ' + t.date);
        var right = document.createElement('div');
        right.className = 'ticket-right';
        appendText(right, 'span', 'status-pill status-' + status, statusLabel[status]);
        row.appendChild(main);
        row.appendChild(right);
        list.appendChild(row);
      });
    }
    renderTickets();

    // New ticket form
    var ticketForm = document.querySelector('#ticket-form');
    if (ticketForm) {
      ticketForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var tickets = JSON.parse(sessionStorage.getItem('pt_demo_tickets') || '[]');
        var nextNum = 1043 + tickets.length;
        var deviceSel = document.querySelector('#ticket-device');
        var titleInput = document.querySelector('#ticket-title-input');
        var newTicket = {
          id: 'TCK-' + nextNum,
          title: titleInput.value.trim() || 'New issue reported',
          device: deviceSel ? deviceSel.value : 'Unspecified device',
          status: 'open',
          date: 'Today'
        };
        trackEvent('ticket_submit', { ticketId: newTicket.id, device: newTicket.device });
        sendCRMLead('ticket_submit', newTicket);
        tickets.unshift(newTicket);
        sessionStorage.setItem('pt_demo_tickets', JSON.stringify(tickets));
        ticketForm.reset();
        renderTickets();
        var successMsg = document.querySelector('#ticket-success');
        if (successMsg) {
          successMsg.classList.remove('hidden');
          setTimeout(function () { successMsg.classList.add('hidden'); }, 4000);
        }
        // switch to tickets tab so the user sees it land in the list
        var ticketsTabBtn = document.querySelector('.dash-nav button[data-panel="tickets"]');
        if (ticketsTabBtn) ticketsTabBtn.click();
      });
    }

    // Logout
    var logoutBtn = document.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        sessionStorage.removeItem('pt_demo_logged_in');
        sessionStorage.removeItem('pt_demo_tickets');
        window.location.href = 'login.html';
      });
    }
  }

  // (Old cart system replaced with enhanced version above)
});

