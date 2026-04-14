const slides = Array.from(document.querySelectorAll(".slide"));
const dots = Array.from(document.querySelectorAll(".dot"));
const prevButton = document.querySelector(".prev");
const nextButton = document.querySelector(".next");
const homeView = document.querySelector(".home-view");
const marketView = document.querySelector(".market-view");
const openViewButtons = Array.from(document.querySelectorAll("[data-open-view]"));
const backHomeButtons = Array.from(document.querySelectorAll("[data-back-home]"));
const productPreview = document.querySelector("#product-preview");
const lightbox = document.querySelector("#image-lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const closeLightboxButtons = Array.from(document.querySelectorAll("[data-close-lightbox]"));
const sliderImage1 = document.querySelector("#slider-image-1");
const sliderImage2 = document.querySelector("#slider-image-2");

let currentSlide = 0;
let autoPlay = null;

function showSlide(index) {
  currentSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, idx) => {
    slide.classList.toggle("active", idx === currentSlide);
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === currentSlide);
  });
}

function startAutoPlay() {
  stopAutoPlay();
  autoPlay = window.setInterval(() => {
    showSlide(currentSlide + 1);
  }, 8000);
}

function stopAutoPlay() {
  if (autoPlay) {
    window.clearInterval(autoPlay);
  }
}

function showMarketView() {
  if (!homeView || !marketView) {
    return;
  }

  homeView.hidden = true;
  marketView.hidden = false;
  stopAutoPlay();
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadProducts();
}

function showHomeView() {
  if (!homeView || !marketView) {
    return;
  }

  marketView.hidden = true;
  homeView.hidden = false;
  startAutoPlay();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderProducts(products) {
  if (!productPreview) {
    return;
  }

  if (!products.length) {
    productPreview.innerHTML = `
      <div class="empty-state">
        <h3>Belum ada produk</h3>
        <p>Stok best seller akan muncul di sini setelah admin menambahkannya dari panel backend.</p>
      </div>
    `;
    return;
  }

  productPreview.innerHTML = products
    .map((product) => {
      const checkoutLink = product.checkoutLink || "#kontak";
      return `
        <article class="generated-card">
          <div class="generated-head">
            <span>XVYN ROBLOX</span>
            <span>BEST SELLER</span>
          </div>
          <div class="generated-body">
            <div class="generated-media">
              ${product.imageData
                ? `<button class="generated-media-button" type="button" data-preview-image="${escapeHtml(product.imageData)}" data-preview-alt="${escapeHtml(product.title)}"><img src="${escapeHtml(product.imageData)}" alt="${escapeHtml(product.title)}"></button>`
                : `<div class="generated-placeholder">Foto Produk</div>`}
            </div>
            <div class="generated-code">${escapeHtml(product.code)}</div>
            <div class="generated-banner">${escapeHtml(product.banner)}</div>
            <div class="generated-price">
              <strong>${escapeHtml(product.price)}</strong>
              <small>${escapeHtml(product.secondaryPrice || "-")}</small>
            </div>
            <h3 class="generated-title">${escapeHtml(product.title)}</h3>
            <p class="generated-description">${escapeHtml(product.description || "Tanpa deskripsi.")}</p>
            <div class="generated-actions">
              <a class="checkout-btn" href="${escapeHtml(checkoutLink)}" target="_blank" rel="noreferrer">Checkout Sekarang</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadProducts() {
  if (!productPreview) {
    return;
  }

  productPreview.innerHTML = `
    <div class="empty-state">
      <h3>Memuat produk</h3>
      <p>Sedang mengambil stok best seller terbaru.</p>
    </div>
  `;

  try {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error("Gagal memuat produk");
    }

    const products = await response.json();
    renderProducts(products);
  } catch (error) {
    productPreview.innerHTML = `
      <div class="empty-state">
        <h3>Produk gagal dimuat</h3>
        <p>Silakan coba lagi beberapa saat.</p>
      </div>
    `;
  }
}

function renderSliderImage(container, imageData, altText) {
  if (!container) {
    return;
  }

  if (!imageData) {
    container.innerHTML = "";
    container.classList.remove("has-image");
    return;
  }

  container.innerHTML = `<img src="${escapeHtml(imageData)}" alt="${escapeHtml(altText)}">`;
  container.classList.add("has-image");
}

async function loadSiteSettings() {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) {
      throw new Error("Gagal memuat settings");
    }

    const settings = await response.json();
    renderSliderImage(sliderImage1, settings?.sliderImages?.slide1 || "", "Banner slide 1");
    renderSliderImage(sliderImage2, settings?.sliderImages?.slide2 || "", "Banner slide 2");
  } catch (error) {
    renderSliderImage(sliderImage1, "", "Banner slide 1");
    renderSliderImage(sliderImage2, "", "Banner slide 2");
  }
}

function openLightbox(imageSrc, imageAlt) {
  if (!lightbox || !lightboxImage) {
    return;
  }

  lightboxImage.src = imageSrc;
  lightboxImage.alt = imageAlt || "Preview produk";
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  if (!lightbox || !lightboxImage) {
    return;
  }

  lightbox.hidden = true;
  lightboxImage.src = "";
  document.body.classList.remove("lightbox-open");
}

prevButton.addEventListener("click", () => {
  showSlide(currentSlide - 1);
  startAutoPlay();
});

nextButton.addEventListener("click", () => {
  showSlide(currentSlide + 1);
  startAutoPlay();
});

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    showSlide(Number(dot.dataset.slide));
    startAutoPlay();
  });
});

openViewButtons.forEach((button) => {
  button.addEventListener("click", showMarketView);
});

backHomeButtons.forEach((button) => {
  button.addEventListener("click", showHomeView);
});

productPreview?.addEventListener("click", (event) => {
  const previewButton = event.target.closest("[data-preview-image]");
  if (!previewButton) {
    return;
  }

  openLightbox(previewButton.dataset.previewImage, previewButton.dataset.previewAlt);
});

closeLightboxButtons.forEach((button) => {
  button.addEventListener("click", closeLightbox);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLightbox();
  }
});

loadSiteSettings();
showSlide(0);
startAutoPlay();
