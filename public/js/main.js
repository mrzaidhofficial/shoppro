(function() {
  'use strict';

  var modal = document.getElementById('quickViewModal');
  var closeBtn = document.getElementById('closeQuickView');
  var content = document.getElementById('quickViewContent');
  var backToTop = document.getElementById('backToTop');
  var header = document.getElementById('siteHeader');

  // Header scroll effect
  window.addEventListener('scroll', function() {
    if (header && window.scrollY > 50) {
      header.classList.add('scrolled');
    } else if (header) {
      header.classList.remove('scrolled');
    }
    if (backToTop) {
      if (window.scrollY > 500) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }
  });

  // Back to top
  if (backToTop) {
    backToTop.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Quick View Modal
  function showLoading() {
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:var(--primary);"></i></div>';
  }

  document.querySelectorAll('.quick-view-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var productId = this.getAttribute('data-id');
      modal.classList.add('active');
      showLoading();
      document.body.style.overflow = 'hidden';

      fetch('/products/' + productId)
        .then(function(res) { return res.text(); })
        .then(function(html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var name = doc.querySelector('.product-info-title') ? doc.querySelector('.product-info-title').textContent.trim() : 'Product';
          var category = doc.querySelector('.product-info-category') ? doc.querySelector('.product-info-category').textContent.trim() : '';
          var price = doc.querySelector('.product-info-price') ? doc.querySelector('.product-info-price').textContent.trim() : '';
          
          var shortDescEl = doc.querySelector('.product-info-short-desc');
          var description = '';
          if (shortDescEl) {
            description = shortDescEl.textContent.trim();
          } else {
            var fullDescEl = doc.querySelector('.product-info-description');
            if (fullDescEl) {
              description = fullDescEl.textContent.trim();
              if (description.length > 200) {
                description = description.substring(0, 200) + '...';
              }
            }
          }
          
          var image = doc.querySelector('.product-gallery-main img') ? doc.querySelector('.product-gallery-main img').src : 'https://picsum.photos/600/600';
          var ratingHTML = doc.querySelector('.product-info-rating') ? doc.querySelector('.product-info-rating').innerHTML : '';
          var specsHTML = doc.querySelector('.product-specs') ? doc.querySelector('.product-specs').innerHTML : '';
          var addToCartForm = doc.querySelector('form[action*="/cart/add/"]');
          var productLink = '/products/' + productId;

          var html2 = '';
          html2 += '<div class="qv-grid">';
          // Image column - stretches to match content height
          html2 += '<div class="qv-image-col">';
          html2 += '<div class="qv-image-wrapper">';
          html2 += '<img src="' + image + '" class="qv-image" onerror="this.src=\'https://picsum.photos/600/600\'">';
          html2 += '</div></div>';
          // Content column
          html2 += '<div class="qv-content-col">';
          if (category) html2 += '<span class="qv-category">' + category + '</span>';
          html2 += '<h3 class="qv-title">' + name + '</h3>';
          if (ratingHTML) html2 += '<div class="qv-rating">' + ratingHTML + '</div>';
          if (price) html2 += '<div class="qv-price">' + price + '</div>';
          if (description) html2 += '<p class="qv-desc">' + description + '</p>';
          if (specsHTML) html2 += '<div class="qv-specs">' + specsHTML + '</div>';
          // Buttons
          html2 += '<div class="qv-buttons">';
          html2 += '<a href="' + productLink + '" class="qv-btn-details">Full Details</a>';
          if (addToCartForm) {
            html2 += '<form action="' + addToCartForm.getAttribute('action') + '" method="POST" class="qv-add-form"><input type="hidden" name="quantity" value="1"><button type="submit" class="qv-btn-cart"><i class="fas fa-cart-shopping"></i> Add to Cart</button></form>';
          }
          html2 += '</div></div></div>';
          
          content.innerHTML = html2;
          
          // Inject styles for the quick view grid
          var styleEl = document.createElement('style');
          styleEl.textContent = '.qv-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:stretch;}.qv-image-col{display:flex;}.qv-image-wrapper{width:100%;border-radius:16px;overflow:hidden;background:#f3f4f6;display:flex;align-items:stretch;}.qv-image{width:100%;height:100%;object-fit:cover;display:block;}.qv-content-col{display:flex;flex-direction:column;}.qv-category{display:inline-block;font-size:0.72rem;color:var(--primary);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:10px;background:var(--primary-light);padding:5px 14px;border-radius:20px;width:fit-content;}.qv-title{font-family:var(--font-display);font-size:1.4rem;font-weight:700;color:#111827;margin:10px 0 8px;line-height:1.3;}.qv-rating{margin-bottom:12px;}.qv-price{font-size:1.6rem;font-weight:700;color:var(--primary);margin-bottom:14px;}.qv-desc{color:#6B7280;line-height:1.65;margin-bottom:16px;font-size:0.9rem;}.qv-specs{margin-bottom:18px;background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;}.qv-specs table{width:100%;border-collapse:collapse;}.qv-specs tr{border-bottom:1px solid #e5e7eb;}.qv-specs tr:last-child{border-bottom:none;}.qv-specs td{padding:12px 16px;font-size:0.88rem;}.qv-specs td:first-child{font-weight:600;color:#111827;width:40%;background:#f3f4f6;}.qv-specs td:last-child{color:#6B7280;}.qv-buttons{display:flex;gap:10px;margin-top:auto;}.qv-btn-details{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border:2px solid var(--primary);border-radius:9999px;font-size:0.85rem;font-weight:600;color:var(--primary);text-decoration:none;height:42px;transition:all 0.2s ease;}.qv-btn-details:hover{background:var(--primary);color:white;}.qv-btn-cart{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border:none;border-radius:9999px;font-size:0.85rem;font-weight:600;cursor:pointer;background:var(--primary-gradient);color:white;height:42px;font-family:var(--font-primary);transition:all 0.2s ease;}.qv-btn-cart:hover{opacity:0.9;}.qv-add-form{flex:1;margin:0;}@media(max-width:768px){.qv-grid{grid-template-columns:1fr;}.qv-image-wrapper{aspect-ratio:1;}}';
          content.appendChild(styleEl);
        })
        .catch(function() {
          content.innerHTML = '<div style="text-align:center;padding:60px;"><p style="color:#6B7280;">Unable to load product details.</p></div>';
        });
    });
  });

  function closeModal() { modal.classList.remove('active'); document.body.style.overflow = ''; }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  window.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });

  // AJAX Add to Cart - No page reload, updates cart badge
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form.action && form.action.indexOf('/cart/add/') !== -1) {
      e.preventDefault();
      var formData = new FormData(form);
      fetch(form.action, {
        method: 'POST',
        body: new URLSearchParams(formData),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      .then(function(res) {
        if (res.redirected) {
          window.location.href = res.url;
          return;
        }
        return res.text();
      })
      .then(function() {
        fetch('/cart/count')
          .then(function(res) { return res.json(); })
          .then(function(data) {
            var badges = document.querySelectorAll('.cart-badge');
            badges.forEach(function(badge) {
              if (data.count > 0) {
                badge.textContent = data.count;
                badge.style.display = 'flex';
              } else {
                badge.style.display = 'none';
              }
            });
          });
      })
      .catch(function(err) {
        console.error('Add to cart error:', err);
      });
    }
  });

  // Auto-dismiss alerts
  document.querySelectorAll('.alert').forEach(function(a) {
    setTimeout(function() { a.style.opacity = '0'; a.style.transition = 'opacity 0.3s'; setTimeout(function() { if (a.parentElement) a.remove(); }, 300); }, 5000);
  });

})();